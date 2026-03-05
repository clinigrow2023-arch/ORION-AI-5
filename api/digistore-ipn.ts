import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendNewUserEmail, sendExistingUserEmail } from "../lib/email.js";

// IPN Passphrase configured in DigiStore IPN settings
const IPN_PASSPHRASE = process.env.DIGISTORE_IPN_PASSPHRASE || "";

// Site base URL (for login and thank you page)
const SITE_URL = process.env.SITE_URL || "https://your-site.vercel.app";

/**
 * Debug mode: To temporarily disable signature validation (for debugging only)
 * Set environment variable: DIGISTORE_ALLOW_WITHOUT_SIGNATURE=true
 * WARNING: DO NOT use in production! This disables IPN security.
 */

/**
 * Generates SHA512 signature according to DigiStore specification
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

  // Remove sha_sign and SHASIGN from parameters
  const cleanParams = { ...parameters };
  delete cleanParams["sha_sign"];
  delete cleanParams["SHASIGN"];

  // Sort keys
  const keys = Object.keys(cleanParams);
  const keysToSort = keys.map((key) =>
    sortCaseSensitive ? key : key.toUpperCase()
  );

  // Sort maintaining correspondence with values
  const sortedPairs = keys
    .map((key, index) => ({ key, sortKey: keysToSort[index] }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // Build SHA string
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
 * Generates secure random password
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
 * Extracts value from POST data
 */
function postedValue(data: Record<string, any>, varname: string): string {
  return data[varname] || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // DigiStore sends data via POST form-urlencoded
  res.setHeader("Content-Type", "text/plain");

  if (req.method !== "POST") {
    return res.status(405).send("ERROR: Method not allowed");
  }

  try {
    // Parse POST data (form-urlencoded)
    // DigiStore sends data as application/x-www-form-urlencoded
    const postData: Record<string, string> = {};

    // Log raw body for debugging
    const contentType =
      req.headers["content-type"] || req.headers["Content-Type"] || "";
    const isExpress =
      typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      !Buffer.isBuffer(req.body);
    // Log removido por segurança (não expor informações de requisição)

    // Parse body - Express already does automatic parsing, Vercel doesn't
    let bodyString = "";

    // Try to use rawBody if available (captured before Express parsing)
    const rawBody = (req as any).rawBody;
    if (rawBody && typeof rawBody === "string") {
      // Log removido por segurança
      bodyString = rawBody;
    } else {
      // Log removido por segurança
    }

    if (req.body) {
      if (
        typeof req.body === "object" &&
        !Array.isArray(req.body) &&
        !Buffer.isBuffer(req.body) &&
        !bodyString // Only use parsed body if we don't have rawBody
      ) {
        // Body already parsed as object (Express with express.urlencoded)
        // Detailed log of received values for debugging
        const sampleValues = Object.entries(req.body)
          .slice(0, 5)
          .reduce((acc, [key, value]) => {
            acc[key] = {
              type: typeof value,
              isArray: Array.isArray(value),
              value: value,
              stringValue: String(value),
              length: Array.isArray(value)
                ? value.length
                : typeof value === "string"
                ? value.length
                : "N/A",
            };
            return acc;
          }, {} as Record<string, any>);
        // Log removido por segurança

        // Convert all values to string (may come as array due to extended: true)
        for (const [key, value] of Object.entries(req.body)) {
          if (Array.isArray(value)) {
            // If array, get first value (express.urlencoded with extended: true)
            postData[key] = value.length > 0 ? String(value[0]) : "";
          } else if (value !== null && value !== undefined) {
            const strValue = String(value);
            // If string is not empty, use it; otherwise, keep empty
            postData[key] = strValue;
          } else {
            postData[key] = "";
          }
        }

        // Log after processing to verify
        const processedSample = Object.entries(postData)
          .slice(0, 5)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);
        // Log removido por segurança
      } else if (bodyString) {
        // Use rawBody if available (better for form-urlencoded)
        // Log removido por segurança
        try {
          const params = new URLSearchParams(bodyString);
          params.forEach((value, key) => {
            postData[key] = value;
          });
        } catch (parseError) {
          // Log removido por segurança
          // Tentar parse alternativo
          try {
            const pairs = bodyString.split("&");
            for (const pair of pairs) {
              const equalIndex = pair.indexOf("=");
              if (equalIndex > 0) {
                const key = decodeURIComponent(pair.substring(0, equalIndex));
                const value = decodeURIComponent(
                  pair.substring(equalIndex + 1)
                );
                if (key) {
                  postData[key] = value || "";
                }
              }
            }
          } catch (altParseError) {
            // Log removido por segurança
          }
        }
      } else {
        // Convert to string if necessary (Vercel - raw body)
        if (Buffer.isBuffer(req.body)) {
          bodyString = req.body.toString("utf-8");
        } else if (typeof req.body === "string") {
          bodyString = req.body;
        } else {
          bodyString = String(req.body);
        }

        // Parse manual de form-urlencoded (para Vercel)
        if (bodyString) {
          try {
            const params = new URLSearchParams(bodyString);
            params.forEach((value, key) => {
              postData[key] = value;
            });
          } catch (parseError) {
            // Log removido por segurança
            // Tentar parse alternativo se URLSearchParams falhar
            try {
              const pairs = bodyString.split("&");
              for (const pair of pairs) {
                const equalIndex = pair.indexOf("=");
                if (equalIndex > 0) {
                  const key = decodeURIComponent(pair.substring(0, equalIndex));
                  const value = decodeURIComponent(
                    pair.substring(equalIndex + 1)
                  );
                  if (key) {
                    postData[key] = value || "";
                  }
                }
              }
            } catch (altParseError) {
              // Log removido por segurança
            }
          }
        }
      }
    }

    // Fallback: tentar usar query parameters se body estiver vazio
    if (
      Object.keys(postData).length === 0 &&
      req.query &&
      Object.keys(req.query).length > 0
    ) {
      // Log removido por segurança
      Object.assign(postData, req.query as Record<string, string>);
    }

    // Check if any data was parsed
    // For connection_test, there may be no data, so we treat it specially
    const eventType = postedValue(postData, "event");

    // Check if all values are empty (may be connection test)
    const hasAnyValue = Object.values(postData).some(
      (value) => value && value.trim() !== ""
    );
    const isEmptyRequest = Object.keys(postData).length === 0 || !hasAnyValue;

    // Log when real data is detected (filled values)
    if (!isEmptyRequest) {
      // Log removido por segurança (não expor dados de pagamento)
    }

    if (isEmptyRequest) {
      // If there's no data or all values are empty, may be connection_test
      if (eventType === "" || eventType === "connection_test" || !eventType) {
        // Log removido por segurança
        return res.status(200).send("OK");
      }

      // Log removido por segurança (não expor informações de requisição)

      // If it's a test but not an explicit connection_test, return OK anyway
      // (may be a DigiStore test with empty fields)
      // Log removido por segurança
      return res.status(200).send("OK");
    }

    // Detailed log of parsed data
    // Check for signature fields (case-insensitive search)
    const signatureFields: Record<string, string> = {};
    Object.keys(postData).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("sha") ||
        lowerKey.includes("sign") ||
        lowerKey.includes("hash")
      ) {
        signatureFields[key] = postData[key];
      }
    });

    // Log removido por segurança (não expor orderId, email, ou assinatura)

    const apiMode = postedValue(postData, "api_mode"); // 'live' or 'test'

    // connection_test doesn't need signature validation - return OK immediately
    if (eventType === "connection_test") {
      // Log removido por segurança
      return res.status(200).send("OK");
    }

    // Validate signature if passphrase is configured (except for connection_test)
    const mustValidateSignature = IPN_PASSPHRASE !== "";
    if (mustValidateSignature) {
      // Try different variations of signature field name
      // DigiStore may send in different formats
      // Also search case-insensitively for any field containing "sha" or "sign"
      let receivedSignature = "";

      // First try known field names
      const knownFields = [
        "sha_sign",
        "SHASIGN",
        "sha_signature",
        "SHA_SIGN",
        "signature",
        "SHA_SIGN_DIGISTORE",
        "sha_sign_digistore",
      ];

      for (const field of knownFields) {
        const value = postedValue(postData, field);
        if (value && value.trim() !== "") {
          receivedSignature = value;
          // Log removido por segurança
          break;
        }
      }

      // If not found, search case-insensitively
      if (!receivedSignature) {
        for (const [key, value] of Object.entries(postData)) {
          const lowerKey = key.toLowerCase();
          if (
            (lowerKey.includes("sha") || lowerKey.includes("sign")) &&
            value &&
            String(value).trim() !== ""
          ) {
            receivedSignature = String(value);
            // Log removido por segurança
            break;
          }
        }
      }

      // Detailed log before calculating expected signature
      // Log removido por segurança (não expor informações de assinatura)

      const expectedSignature = digistoreSignature(IPN_PASSPHRASE, postData);

      if (receivedSignature !== expectedSignature) {
        // Check if in debug mode
        const allowWithoutSignature =
          process.env.DIGISTORE_ALLOW_WITHOUT_SIGNATURE === "true";
        const isDebugMode =
          allowWithoutSignature || process.env.NODE_ENV === "development";

        // Log removido por segurança

        // If in debug mode or no signature received, allow to continue
        if (isDebugMode || !receivedSignature) {
          if (!receivedSignature) {
            // Log removido por segurança
            // In production, block if there's no signature
            if (process.env.NODE_ENV === "production") {
              return res.status(400).send("ERROR: invalid sha signature");
            }
          } else {
            // Log removido por segurança
          }
        } else {
          return res.status(400).send("ERROR: invalid sha signature");
        }
      } else {
        // Log removido por segurança
      }
    } else {
      // Log removido por segurança
    }

    // Process events
    // DigiStore may send "payment" or "on_payment" - normalize to "on_payment"
    const normalizedEventType =
      eventType === "payment" ? "on_payment" : eventType;

    switch (normalizedEventType) {
      case "on_payment": {
        const orderId = postedValue(postData, "order_id");
        const productId = postedValue(postData, "product_id");
        const productName = postedValue(postData, "product_name");
        const billingType = postedValue(postData, "billing_type");
        const rebillDate = postedValue(postData, "rebill_date"); // Date of next recurring payment

        const email = postedValue(postData, "email");
        // DigiStore may send "first_name" or "address_first_name" - try both
        const firstName =
          postedValue(postData, "address_first_name") ||
          postedValue(postData, "first_name");
        const lastName =
          postedValue(postData, "address_last_name") ||
          postedValue(postData, "last_name");

        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor dados de pagamento)

        // Validations
        if (!email || !firstName) {
          // Log removido por segurança
          return res.status(400).send("ERROR: Missing required fields");
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          // Log removido por segurança (não expor email)
          return res.status(400).send("ERROR: Invalid email format");
        }

        const emailLower = email.toLowerCase().trim();
        const fullName = `${firstName} ${lastName}`.trim() || firstName.trim();

        // Calculate next payment date
        // If rebillDate is provided, use it; otherwise, calculate 1 month from now
        let nextPaymentDate: Date | null = null;
        const now = new Date();

        if (rebillDate) {
          try {
            nextPaymentDate = new Date(rebillDate);
          } catch (e) {
            // Log removido por segurança
            // Fallback: calculate 1 month from now
            nextPaymentDate = new Date(now);
            nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
          }
        } else {
          // No rebillDate provided - calculate 1 month from payment date
          nextPaymentDate = new Date(now);
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
          // Log removido por segurança
        }

        // Check if user already exists (by email or orderId)
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ email: emailLower }, { digistoreOrderId: orderId }],
          },
        });

        let tempPasswordForDisplay = "";
        const saltRounds = 10;

        if (user) {
          // Check if legacy user (without digistoreOrderId or subscriptionStatus)
          const isLegacyUser =
            !user.digistoreOrderId || !user.subscriptionStatus;

          if (isLegacyUser) {
            // Log removido por segurança (não expor email ou informações de usuário)
          }

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
              // Log removido por segurança (não expor email)

              // Enviar email com nova senha temporária
              try {
                await sendNewUserEmail(
                  user.email,
                  user.name,
                  tempPasswordForDisplay
                );
              } catch (emailError) {
                // Log removido por segurança
                // Não bloquear o processo se email falhar
              }
            } else {
              // Usuário já ativo (pode ser legado) - atualizar dados de assinatura SEM alterar senha
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  digistoreOrderId: orderId,
                  subscriptionStatus: "active",
                  lastPaymentDate: now,
                  nextPaymentDate: nextPaymentDate,
                  productId: productId || user.productId,
                  billingType: billingType || user.billingType,
                  isBlocked: false, // Garantir que está desbloqueado
                },
              });
              // Log removido por segurança (não expor email)

              // Enviar email informando que acesso foi liberado
              try {
                await sendExistingUserEmail(user.email, user.name);
              } catch (emailError) {
                // Log removido por segurança
                // Não bloquear o processo se email falhar
              }

              // Não retornar senha para usuário já ativo (mantém senha atual)
              return res.status(200).send("OK");
            }
          } else {
            // Usuário já ativo e com assinatura ativa - RENOVAÇÃO: apenas atualizar dados de pagamento, SEM enviar email
            // Email de acesso é enviado apenas 1x (novo usuário ou reativação), não em toda renovação
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                digistoreOrderId: orderId,
                lastPaymentDate: now,
                nextPaymentDate: nextPaymentDate,
                productId: productId || user.productId,
                billingType: billingType || user.billingType,
                isBlocked: false, // Garantir que está desbloqueado
              },
            });

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

          // Log removido por segurança (não expor email)

          // Enviar email com credenciais para novo usuário
          try {
            await sendNewUserEmail(
              user.email,
              user.name,
              tempPasswordForDisplay
            );
          } catch (emailError) {
            // Log removido por segurança
            // Não bloquear o processo se email falhar
          }
        }

        // Preparar dados de acesso para retornar à DigiStore
        // Nota: Email já foi enviado diretamente, mas também retornamos para a DigiStore como backup
        const username = emailLower; // Usar email como username

        const loginUrl = `${SITE_URL}/#login`;
        const thankyouUrl = `${SITE_URL}/#login`;

        const headline = "Your Access Credentials";
        const showOn = "all"; // Mostrar em todos os lugares
        const hideOn = "none";

        // Retornar resposta no formato esperado pela DigiStore
        // Só incluir senha se for novo usuário ou usuário reativado (que recebeu nova senha)
        const response = tempPasswordForDisplay
          ? `OK
thankyou_url: ${thankyouUrl}
username: ${username}
password: ${tempPasswordForDisplay}
loginurl: ${loginUrl}
headline: ${headline}
show_on: ${showOn}
hide_on: ${hideOn}`
          : `OK
thankyou_url: ${thankyouUrl}
username: ${username}
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

        // Log removido por segurança (não expor dados de pagamento)

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
          // Log removido por segurança (não expor email)
        } else {
          // Log removido por segurança (não expor orderId ou email)
        }

        return res.status(200).send("OK");
      }

      case "on_refund": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor dados de pagamento)

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
          // Log removido por segurança (não expor email)
        } else {
          // Log removido por segurança (não expor orderId ou email)
        }

        return res.status(200).send("OK");
      }

      case "on_chargeback": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor dados de pagamento)

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
          // Log removido por segurança (não expor email)
        } else {
          // Log removido por segurança (não expor orderId ou email)
        }

        return res.status(200).send("OK");
      }

      case "on_rebill_resumed": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const rebillDate = postedValue(postData, "rebill_date");
        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor dados de pagamento)

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
              // Log removido por segurança
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
          // Log removido por segurança (não expor email)
        } else {
          // Log removido por segurança (não expor orderId ou email)
        }

        return res.status(200).send("OK");
      }

      case "on_rebill_cancelled": {
        const orderId = postedValue(postData, "order_id");
        const email = postedValue(postData, "email");
        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor orderId, email ou dados de pagamento)

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
          // Log removido por segurança (não expor email)
        } else {
          // Log removido por segurança (não expor orderId ou email)
        }

        return res.status(200).send("OK");
      }

      case "on_affiliation": {
        const email = postedValue(postData, "email");
        const digistoreId = postedValue(postData, "affiliate_name");
        const isTestMode = apiMode !== "live";

        // Log removido por segurança (não expor email ou dados de afiliação)

        return res.status(200).send("OK");
      }

      default:
        // Log removido por segurança
        return res.status(200).send("OK");
    }
  } catch (error: any) {
    // Log removido por segurança (não expor stack trace ou detalhes de erro)
    return res
      .status(500)
      .send(`ERROR: ${error.message || "Internal server error"}`);
  }
}
