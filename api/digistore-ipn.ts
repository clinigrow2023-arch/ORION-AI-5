import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
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
        const rebillDate = postedValue(postData, "rebill_date"); // Data do próximo pagamento recorrente

        const email = postedValue(postData, "email");
        const firstName = postedValue(postData, "address_first_name");
        const lastName = postedValue(postData, "address_last_name");

        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Payment received", {
          orderId,
          productId,
          productName,
          billingType,
          email,
          firstName,
          lastName,
          rebillDate,
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

        // Calcular próxima data de pagamento se for recorrente
        let nextPaymentDate: Date | null = null;
        if (rebillDate) {
          try {
            nextPaymentDate = new Date(rebillDate);
          } catch (e) {
            console.warn("Invalid rebill_date format:", rebillDate);
          }
        }

        // Verificar se usuário já existe (por email ou orderId)
        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: emailLower },
              { digistoreOrderId: orderId },
            ],
          },
        });

        let tempPasswordForDisplay = "";
        const saltRounds = 10;
        const now = new Date();

        if (user) {
          // Se usuário já existe, atualizar dados de assinatura e ativar
          if (!user.isActive || user.subscriptionStatus !== "active") {
            // Gerar nova senha temporária se estiver inativo
            if (!user.isActive) {
              tempPasswordForDisplay = generateRandomPassword(12);
              const tempPasswordHash = await bcrypt.hash(
                tempPasswordForDisplay,
                saltRounds
              );

              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  isActive: true,
                  isBlocked: false, // Desbloquear se estava bloqueado
                  passwordResetRequired: true,
                  password: tempPasswordHash,
                  // Atualizar dados de assinatura
                  digistoreOrderId: orderId,
                  subscriptionStatus: "active",
                  lastPaymentDate: now,
                  nextPaymentDate: nextPaymentDate,
                  productId: productId || user.productId,
                  billingType: billingType || user.billingType,
                },
              });
              console.log(
                "User activated with new temporary password:",
                user.email
              );
            } else {
              // Usuário já ativo, apenas atualizar dados de assinatura
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  digistoreOrderId: orderId,
                  subscriptionStatus: "active",
                  lastPaymentDate: now,
                  nextPaymentDate: nextPaymentDate,
                  productId: productId || user.productId,
                  billingType: billingType || user.billingType,
                },
              });
              console.log("User subscription updated:", user.email);
              // Não retornar senha para usuário já ativo
              return res.status(200).send("OK");
            }
          } else {
            // Usuário já ativo e com assinatura ativa - apenas atualizar dados
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                digistoreOrderId: orderId,
                lastPaymentDate: now,
                nextPaymentDate: nextPaymentDate,
                productId: productId || user.productId,
                billingType: billingType || user.billingType,
              },
            });
            console.log("User already exists and is active:", user.email);
            return res.status(200).send("OK");
          }
        } else {
          // Criar novo usuário
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
              isBlocked: false,
              passwordResetRequired: true, // Precisa trocar a senha no primeiro login
              // Dados de assinatura
              digistoreOrderId: orderId,
              subscriptionStatus: "active",
              lastPaymentDate: now,
              nextPaymentDate: nextPaymentDate,
              productId: productId,
              billingType: billingType,
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
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Payment missed", {
          orderId,
          email,
          isTestMode,
        });

        // Buscar usuário por orderId ou email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { digistoreOrderId: orderId },
              { email: email?.toLowerCase().trim() },
            ],
          },
        });

        if (user) {
          // Desativar e bloquear usuário quando não pagar
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true, // Bloquear acesso
              subscriptionStatus: "payment_missed",
              nextPaymentDate: null, // Remover próxima data de pagamento
            },
          });
          console.log(
            "User deactivated and blocked due to missed payment:",
            user.email
          );
        } else {
          console.warn("User not found for payment_missed event:", {
            orderId,
            email,
          });
        }

        return res.status(200).send("OK");
      }

      case "on_refund": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Refund", {
          orderId,
          email,
          isTestMode,
        });

        // Buscar usuário por orderId ou email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { digistoreOrderId: orderId },
              { email: email?.toLowerCase().trim() },
            ],
          },
        });

        if (user) {
          // Remover acesso quando houver reembolso
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true, // Bloquear acesso
              subscriptionStatus: "refunded",
              nextPaymentDate: null,
            },
          });
          console.log("User access removed due to refund:", user.email);
        } else {
          console.warn("User not found for refund event:", { orderId, email });
        }

        return res.status(200).send("OK");
      }

      case "on_chargeback": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Chargeback", {
          orderId,
          email,
          isTestMode,
        });

        // Buscar usuário por orderId ou email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { digistoreOrderId: orderId },
              { email: email?.toLowerCase().trim() },
            ],
          },
        });

        if (user) {
          // Remover acesso quando houver chargeback
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true, // Bloquear acesso
              subscriptionStatus: "chargeback",
              nextPaymentDate: null,
            },
          });
          console.log("User access removed due to chargeback:", user.email);
        } else {
          console.warn("User not found for chargeback event:", {
            orderId,
            email,
          });
        }

        return res.status(200).send("OK");
      }

      case "on_rebill_resumed": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const rebillDate = postedValue(postData, "rebill_date");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Rebill resumed", {
          orderId,
          email,
          rebillDate,
          isTestMode,
        });

        // Buscar usuário por orderId ou email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { digistoreOrderId: orderId },
              { email: email?.toLowerCase().trim() },
            ],
          },
        });

        if (user) {
          // Reativar usuário quando retomar pagamento
          let nextPaymentDate: Date | null = null;
          if (rebillDate) {
            try {
              nextPaymentDate = new Date(rebillDate);
            } catch (e) {
              console.warn("Invalid rebill_date format:", rebillDate);
            }
          }

          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: true,
              isBlocked: false, // Desbloquear
              subscriptionStatus: "active",
              lastPaymentDate: new Date(),
              nextPaymentDate: nextPaymentDate,
            },
          });
          console.log("User reactivated - rebill resumed:", user.email);
        } else {
          console.warn("User not found for rebill_resumed event:", {
            orderId,
            email,
          });
        }

        return res.status(200).send("OK");
      }

      case "on_rebill_cancelled": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        console.log("DigiStore IPN - Rebill cancelled", {
          orderId,
          email,
          isTestMode,
        });

        // Buscar usuário por orderId ou email
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { digistoreOrderId: orderId },
              { email: email?.toLowerCase().trim() },
            ],
          },
        });

        if (user) {
          // Cancelar assinatura e remover acesso
          await prisma.user.update({
            where: { id: user.id },
            data: {
              isActive: false,
              isBlocked: true, // Bloquear acesso
              subscriptionStatus: "cancelled",
              nextPaymentDate: null,
            },
          });
          console.log("User subscription cancelled and access removed:", user.email);
        } else {
          console.warn("User not found for rebill_cancelled event:", {
            orderId,
            email,
          });
        }

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
