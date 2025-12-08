import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// IPN Passphrase configurado nas configurações IPN da DigiStore
const IPN_PASSPHRASE = process.env.DIGISTORE_IPN_PASSPHRASE || "";

// URL base do site (para login e thank you page)
const SITE_URL = process.env.SITE_URL || "https://your-site.vercel.app";

/**
 * Gera assinatura SHA512 conforme especificação da DigiStore
 */
function digistoreSignature(
  shaPassphrase: string,
  parameters: Record<string, string>,
  convertKeysToUppercase: boolean = false,
  doHtmlDecode: boolean = false
): string {
  const algorithm = "sha512";
  const sortCaseSensitive = !convertKeysToUppercase;

  if (!shaPassphrase) {
    return "no_signature_passphrase_provided";
  }

  // Remover sha_sign e SHASIGN dos parâmetros
  const cleanParams = { ...parameters };
  delete cleanParams["sha_sign"];
  delete cleanParams["SHASIGN"];

  // Ordenar chaves
  const keys = Object.keys(cleanParams);
  const keysToSort = keys.map((key) =>
    sortCaseSensitive ? key : key.toUpperCase()
  );

  // Ordenar mantendo correspondência com valores
  const sortedPairs = keys
    .map((key, index) => ({ key, sortKey: keysToSort[index] }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Construir string SHA
  let shaString = "";
  for (const { key } of sortedPairs) {
    let value: string = String(cleanParams[key] || "");

    if (doHtmlDecode) {
      value = value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    }

    const isEmpty = !value || value === "";
    if (isEmpty) {
      continue;
    }

    const upperKey = convertKeysToUppercase ? key.toUpperCase() : key;
    shaString += `${upperKey}=${value}${shaPassphrase}`;
  }

  const shaSign = crypto
    .createHash(algorithm)
    .update(shaString)
    .digest("hex")
    .toUpperCase();

  return shaSign;
}

/**
 * Gera senha aleatória segura
 */
function generateRandomPassword(length: number = 12): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const randomBytes = crypto.randomBytes(length);
  let password = "";

  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  return password;
}

/**
 * Extrai valor do POST
 */
function postedValue(data: Record<string, any>, varname: string): string {
  return data[varname] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // DigiStore envia dados via POST form-urlencoded
  res.setHeader("Content-Type", "text/plain");

  if (req.method !== "POST") {
    return res.status(405).send("ERROR: Method not allowed");
  }

  try {
    // Parse dos dados POST (form-urlencoded)
    // A DigiStore envia dados como application/x-www-form-urlencoded
    const postData: Record<string, string> = {};

    // Vercel já faz parse automático do body
    if (req.body) {
      if (typeof req.body === "object" && !Array.isArray(req.body)) {
        Object.assign(postData, req.body);
      } else if (typeof req.body === "string") {
        // Parse manual de form-urlencoded se necessário
        const params = new URLSearchParams(req.body);
        params.forEach((value, key) => {
          postData[key] = value;
        });
      }
    }

    // Log para debug
    console.log("DigiStore IPN received:", {
      eventType: postData.event,
      orderId: postData.order_id,
      email: postData.email,
    });

    const eventType = postedValue(postData, "event");
    const apiMode = postedValue(postData, "api_mode"); // 'live' or 'test'

    // Validar assinatura se passphrase estiver configurado
    const mustValidateSignature = IPN_PASSPHRASE !== "";
    if (mustValidateSignature) {
      const receivedSignature = postedValue(postData, "sha_sign");
      const expectedSignature = digistoreSignature(IPN_PASSPHRASE, postData);

      if (receivedSignature !== expectedSignature) {
        console.error("Invalid SHA signature", {
          received: receivedSignature,
          expected: expectedSignature,
        });
        return res.status(400).send("ERROR: invalid sha signature");
      }
    }

    // Processar eventos
    switch (eventType) {
      case "connection_test":
        return res.status(200).send("OK");

      case "on_payment": {
        const orderId = postedValue(postData, "order_id");
        const productId = postedValue(postData, "product_id");
        const productName = postedValue(postData, "product_name");
        const billingType = postedValue(postData, "billing_type");

        const email = postedValue(postData, "email");
        const firstName = postedValue(postData, "address_first_name");
        const lastName = postedValue(postData, "address_last_name");

        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Payment received", {
          orderId,
          productId,
          productName,
          email,
          firstName,
          lastName,
          isTestMode,
        });

        // Validações
        if (!email || !firstName) {
          console.error("Missing required fields: email or first_name");
          return res.status(400).send("ERROR: Missing required fields");
        }

        // Validar formato de email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          console.error("Invalid email format:", email);
          return res.status(400).send("ERROR: Invalid email format");
        }

        const emailLower = email.toLowerCase().trim();
        const fullName = `${firstName} ${lastName}`.trim() || firstName.trim();

        // Verificar se usuário já existe
        let user = await prisma.user.findUnique({
          where: { email: emailLower },
        });

        let tempPasswordForDisplay = "";
        const saltRounds = 10;

        if (user) {
          // Se usuário já existe, apenas ativar se estiver inativo
          if (!user.isActive) {
            // Gerar nova senha temporária para usuário reativado
            tempPasswordForDisplay = generateRandomPassword(12);
            const tempPasswordHash = await bcrypt.hash(
              tempPasswordForDisplay,
              saltRounds
            );

            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                isActive: true,
                passwordResetRequired: true,
                password: tempPasswordHash, // Atualizar com nova senha temporária
              },
            });
            console.log(
              "User activated with new temporary password:",
              user.email
            );
          } else {
            console.log("User already exists and is active:", user.email);
            // Usuário já ativo - não retornar senha, apenas OK
            return res.status(200).send("OK");
          }
        } else {
          // Criar novo usuário
          // Gerar senha aleatória
          tempPasswordForDisplay = generateRandomPassword(12);
          const hashedPassword = await bcrypt.hash(
            tempPasswordForDisplay,
            saltRounds
          );

          // Criar usuário ativo (já que pagou)
          user = await prisma.user.create({
            data: {
              name: fullName,
              email: emailLower,
              password: hashedPassword,
              isActive: true, // Ativo automaticamente pois pagou
              passwordResetRequired: true, // Precisa trocar a senha no primeiro login
            },
          });

          console.log("User created from DigiStore payment:", user.email);
        }

        // Preparar dados de acesso para retornar à DigiStore
        const username = emailLower; // Usar email como username

        const loginUrl = `${SITE_URL}/#login`;
        const thankyouUrl = `${SITE_URL}/#login`;

        const headline = "Seus dados de acesso";
        const showOn = "all"; // Mostrar em todos os lugares
        const hideOn = "none";

        // Retornar resposta no formato esperado pela DigiStore
        const response = `OK
thankyou_url: ${thankyouUrl}
username: ${username}
password: ${tempPasswordForDisplay}
loginurl: ${loginUrl}
headline: ${headline}
show_on: ${showOn}
hide_on: ${hideOn}`;

        return res.status(200).send(response);
      }

      case "on_payment_missed": {
        const orderId = postedValue(postData, "order_id");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Payment missed", { orderId, isTestMode });

        return res.status(200).send("OK");
      }

      case "on_refund": {
        const orderId = postedValue(postData, "order_id");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Refund", { orderId, isTestMode });

        return res.status(200).send("OK");
      }

      case "on_chargeback": {
        const orderId = postedValue(postData, "order_id");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Chargeback", { orderId, isTestMode });

        return res.status(200).send("OK");
      }

      case "on_rebill_resumed": {
        const orderId = postedValue(postData, "order_id");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Rebill resumed", { orderId, isTestMode });

        return res.status(200).send("OK");
      }

      case "on_rebill_cancelled": {
        const orderId = postedValue(postData, "order_id");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Rebill cancelled", {
          orderId,
          isTestMode,
        });

        return res.status(200).send("OK");
      }

      case "on_affiliation": {
        const email = postedValue(postData, "email");
        const digistoreId = postedValue(postData, "affiliate_name");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Affiliation", {
          email,
          digistoreId,
          isTestMode,
        });

        return res.status(200).send("OK");
      }

      default:
        console.log("DigiStore IPN - Unknown event:", eventType);
        return res.status(200).send("OK");
    }
  } catch (error: any) {
    console.error("DigiStore IPN error:", error);
    return res
      .status(500)
      .send(`ERROR: ${error.message || "Internal server error"}`);
  }
}
