import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_prisma.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// IPN Passphrase configurado nas configurações IPN da DigiStore
const IPN_PASSPHRASE = process.env.DIGISTORE_IPN_PASSPHRASE || "";

// URL base do site (para login e thank you page)
const SITE_URL = process.env.SITE_URL || "https://your-site.vercel.app";

/**
 * Modo de debug: Para desabilitar validação de assinatura temporariamente (apenas para debug)
 * Configure a variável de ambiente: DIGISTORE_ALLOW_WITHOUT_SIGNATURE=true
 * ATENÇÃO: NÃO use em produção! Isso desabilita a segurança do IPN.
 */

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

    // Log do body raw para debug
    const contentType =
      req.headers["content-type"] || req.headers["Content-Type"] || "";
    const isExpress =
      typeof req.body === "object" &&
      !Array.isArray(req.body) &&
      !Buffer.isBuffer(req.body);
    console.log("DigiStore IPN - Raw request info:", {
      contentType,
      bodyType: typeof req.body,
      bodyIsArray: Array.isArray(req.body),
      isExpress: isExpress, // Detecta se está rodando no Express (dev-server)
      bodyKeys:
        req.body && typeof req.body === "object"
          ? Object.keys(req.body)
          : "N/A",
      bodyPreview:
        typeof req.body === "string"
          ? req.body.substring(0, 200)
          : req.body
          ? (JSON.stringify(req.body) || "").substring(0, 200)
          : "(empty or undefined)",
    });

    // Parse do body - Express já faz parse automático, Vercel não
    let bodyString = "";

    // Tentar usar rawBody se disponível (capturado antes do parsing do Express)
    const rawBody = (req as any).rawBody;
    if (rawBody && typeof rawBody === "string") {
      console.log(
        "DigiStore IPN - Using rawBody (captured before Express parsing)",
        {
          rawBodyLength: rawBody.length,
          rawBodyPreview: rawBody.substring(0, 200),
        }
      );
      bodyString = rawBody;
    } else {
      console.log("DigiStore IPN - rawBody not available or not string:", {
        hasRawBody: !!rawBody,
        rawBodyType: typeof rawBody,
      });
    }

    if (req.body) {
      if (
        typeof req.body === "object" &&
        !Array.isArray(req.body) &&
        !Buffer.isBuffer(req.body) &&
        !bodyString // Só usar body parseado se não tivermos rawBody
      ) {
        // Body já parseado como objeto (Express com express.urlencoded)
        // Log detalhado dos valores recebidos para debug
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
        console.log("DigiStore IPN - Body values sample:", sampleValues);

        // Converter todos os valores para string (pode vir como array devido ao extended: true)
        for (const [key, value] of Object.entries(req.body)) {
          if (Array.isArray(value)) {
            // Se for array, pegar o primeiro valor (express.urlencoded com extended: true)
            postData[key] = value.length > 0 ? String(value[0]) : "";
          } else if (value !== null && value !== undefined) {
            const strValue = String(value);
            // Se a string não estiver vazia, usar; caso contrário, manter vazio
            postData[key] = strValue;
          } else {
            postData[key] = "";
          }
        }

        // Log após processamento para verificar
        const processedSample = Object.entries(postData)
          .slice(0, 5)
          .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {} as Record<string, string>);
        console.log(
          "DigiStore IPN - Processed values sample:",
          processedSample
        );
      } else if (bodyString) {
        // Usar rawBody se disponível (melhor para form-urlencoded)
        console.log("DigiStore IPN - Parsing rawBody string");
        try {
          const params = new URLSearchParams(bodyString);
          params.forEach((value, key) => {
            postData[key] = value;
          });
        } catch (parseError) {
          console.error(
            "Error parsing URLSearchParams from rawBody:",
            parseError
          );
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
            console.error("Error in alternative parsing:", altParseError);
          }
        }
      } else {
        // Converter para string se necessário (Vercel - body raw)
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
            console.error("Error parsing URLSearchParams:", parseError);
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
              console.error("Error in alternative parsing:", altParseError);
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
      console.warn(
        "DigiStore IPN - Body empty, trying query parameters as fallback"
      );
      Object.assign(postData, req.query as Record<string, string>);
    }

    // Verificar se conseguiu parsear algum dado
    // Para connection_test, pode não ter dados, então tratamos de forma especial
    const eventType = postedValue(postData, "event");

    // Verificar se todos os valores estão vazios (pode ser teste de conexão)
    const hasAnyValue = Object.values(postData).some(
      (value) => value && value.trim() !== ""
    );
    const isEmptyRequest = Object.keys(postData).length === 0 || !hasAnyValue;

    // Log quando detectar dados reais (valores preenchidos)
    if (!isEmptyRequest) {
      console.log("DigiStore IPN - Real data detected (not empty test)", {
        eventType,
        hasValues: hasAnyValue,
        sampleValues: Object.entries(postData)
          .filter(([_, value]) => value && value.trim() !== "")
          .slice(0, 5)
          .reduce((acc, [key, value]) => {
            acc[key] =
              value.length > 50 ? value.substring(0, 50) + "..." : value;
            return acc;
          }, {} as Record<string, string>),
      });
    }

    if (isEmptyRequest) {
      // Se não há dados ou todos estão vazios, pode ser connection_test
      if (eventType === "" || eventType === "connection_test" || !eventType) {
        console.log(
          "DigiStore IPN - Empty request or all values empty, treating as connection test"
        );
        return res.status(200).send("OK");
      }

      console.warn(
        "DigiStore IPN - Request received but all values are empty",
        {
          bodyType: typeof req.body,
          bodyIsBuffer: Buffer.isBuffer(req.body),
          bodyString: bodyString ? bodyString.substring(0, 500) : "(empty)",
          contentType,
          queryKeys: req.query ? Object.keys(req.query) : [],
          headers: Object.keys(req.headers),
          eventType,
          postDataKeys: Object.keys(postData),
          postDataKeysCount: Object.keys(postData).length,
        }
      );

      // Se é um teste mas não é connection_test explícito, retornar OK mesmo assim
      // (pode ser um teste da DigiStore com campos vazios)
      console.log("DigiStore IPN - Returning OK for empty test request");
      return res.status(200).send("OK");
    }

    // Log detalhado dos dados parseados
    console.log("DigiStore IPN received:", {
      eventType: postData.event || postData["event"],
      orderId: postData.order_id || postData["order_id"],
      email: postData.email || postData["email"],
      shaSign: postData.sha_sign || postData["sha_sign"] || postData["SHASIGN"],
      allKeys: Object.keys(postData),
      postDataSample: Object.keys(postData)
        .slice(0, 10)
        .reduce((acc, key) => {
          acc[key] = postData[key];
          return acc;
        }, {} as Record<string, string>),
    });

    const apiMode = postedValue(postData, "api_mode"); // 'live' or 'test'

    // connection_test não precisa de validação de assinatura - retornar OK imediatamente
    if (eventType === "connection_test") {
      console.log("DigiStore IPN - Connection test received");
      return res.status(200).send("OK");
    }

    // Validar assinatura se passphrase estiver configurado (exceto para connection_test)
    const mustValidateSignature = IPN_PASSPHRASE !== "";
    if (mustValidateSignature) {
      // Tentar diferentes variações do nome do campo de assinatura
      const receivedSignature =
        postedValue(postData, "sha_sign") ||
        postedValue(postData, "SHASIGN") ||
        postedValue(postData, "sha_signature") ||
        "";

      // Log detalhado antes de calcular assinatura esperada
      console.log("DigiStore IPN - Signature validation:", {
        eventType,
        hasPassphrase: !!IPN_PASSPHRASE,
        receivedSignature: receivedSignature
          ? `${receivedSignature.substring(0, 20)}...`
          : "(empty)",
        postDataKeys: Object.keys(postData),
        postDataCount: Object.keys(postData).length,
      });

      const expectedSignature = digistoreSignature(IPN_PASSPHRASE, postData);

      if (receivedSignature !== expectedSignature) {
        // Verificar se está em modo de debug
        const allowWithoutSignature =
          process.env.DIGISTORE_ALLOW_WITHOUT_SIGNATURE === "true";
        const isDebugMode =
          allowWithoutSignature || process.env.NODE_ENV === "development";

        console.error("Invalid SHA signature", {
          eventType,
          received: receivedSignature || "(empty)",
          expected: expectedSignature.substring(0, 20) + "...",
          receivedLength: receivedSignature?.length || 0,
          expectedLength: expectedSignature.length,
          postDataKeys: Object.keys(postData),
          postDataCount: Object.keys(postData).length,
          isDebugMode,
          // Log completo dos dados para debug (sem valores sensíveis)
          postDataSample: Object.keys(postData)
            .slice(0, 10)
            .reduce((acc, key) => {
              if (
                key.toLowerCase().includes("password") ||
                key.toLowerCase().includes("secret") ||
                key.toLowerCase().includes("sign")
              ) {
                acc[key] = "***HIDDEN***";
              } else {
                acc[key] = postData[key]
                  ? `${postData[key].substring(0, 30)}...`
                  : "";
              }
              return acc;
            }, {} as Record<string, string>),
        });

        // Se estiver em modo de debug ou não houver assinatura recebida, permitir continuar
        if (isDebugMode || !receivedSignature) {
          if (!receivedSignature) {
            console.warn(
              "DigiStore IPN - No signature received, allowing in development mode"
            );
            // Em produção, bloquear se não houver assinatura
            if (process.env.NODE_ENV === "production") {
              return res.status(400).send("ERROR: invalid sha signature");
            }
          } else {
            console.warn(
              "DigiStore IPN - Allowing request with invalid signature (debug mode)"
            );
          }
        } else {
          return res.status(400).send("ERROR: invalid sha signature");
        }
      } else {
        console.log("DigiStore IPN - Signature validated successfully");
      }
    } else {
      console.warn(
        "DigiStore IPN - Signature validation skipped (no passphrase configured)"
      );
    }

    // Processar eventos
    // A DigiStore pode enviar "payment" ou "on_payment" - normalizar para "on_payment"
    const normalizedEventType = eventType === "payment" ? "on_payment" : eventType;
    
    switch (normalizedEventType) {
      case "on_payment": {
        const orderId = postedValue(postData, "order_id");
        const productId = postedValue(postData, "product_id");
        const productName = postedValue(postData, "product_name");
        const billingType = postedValue(postData, "billing_type");
        const rebillDate = postedValue(postData, "rebill_date"); // Data do próximo pagamento recorrente

        const email = postedValue(postData, "email");
        // A DigiStore pode enviar "first_name" ou "address_first_name" - tentar ambos
        const firstName = postedValue(postData, "address_first_name") || postedValue(postData, "first_name");
        const lastName = postedValue(postData, "address_last_name") || postedValue(postData, "last_name");

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
            OR: [{ email: emailLower }, { digistoreOrderId: orderId }],
          },
        });

        let tempPasswordForDisplay = "";
        const saltRounds = 10;
        const now = new Date();

        if (user) {
          // Verificar se é usuário legado (sem digistoreOrderId ou subscriptionStatus)
          const isLegacyUser =
            !user.digistoreOrderId || !user.subscriptionStatus;

          if (isLegacyUser) {
            console.log(
              "DigiStore IPN - Legacy user detected, migrating to automated system:",
              {
                email: user.email,
                hasOrderId: !!user.digistoreOrderId,
                hasSubscriptionStatus: !!user.subscriptionStatus,
                isActive: user.isActive,
              }
            );
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
              console.log(
                "User activated with new temporary password:",
                user.email
              );
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
              console.log(
                isLegacyUser
                  ? "Legacy user migrated to automated system:"
                  : "User subscription updated:",
                user.email
              );
              // Não retornar senha para usuário já ativo (mantém senha atual)
              return res.status(200).send("OK");
            }
          } else {
            // Usuário já ativo e com assinatura ativa - apenas atualizar dados de pagamento
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
            console.log(
              isLegacyUser
                ? "Legacy user payment updated:"
                : "User already exists and is active:",
              user.email
            );
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
          console.log(
            "User subscription cancelled and access removed:",
            user.email
          );
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
