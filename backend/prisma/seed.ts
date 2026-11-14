import bcrypt from "bcryptjs";
import { FinalidadeOtp, PerfilUsuario, PrismaClient, StatusNegocio } from "@prisma/client";
import { issueOtp } from "../lib/otp";
import { emailProviderConfigured } from "../lib/auth-email";
import { isValidNewPassword } from "../lib/password-policy";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV !== "development") throw new Error("O seed só pode rodar com NODE_ENV=development.");
  const nome = process.env.DEV_ADMIN_NAME?.trim();
  const nomeUsuario = process.env.DEV_ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.DEV_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_ADMIN_PASSWORD;
  if (!nome || !nomeUsuario || !email || !password) throw new Error("Defina DEV_ADMIN_NAME, DEV_ADMIN_USERNAME, DEV_ADMIN_EMAIL e DEV_ADMIN_PASSWORD no processo.");
  if (nome.length > 150 || !/^[a-z0-9._-]{3,50}$/.test(nomeUsuario) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isValidNewPassword(password)) throw new Error("Invalid development credentials.");
  if (!emailProviderConfigured()) throw new Error("Email provider not configured; no database changes made.");
  if (await prisma.usuario.count() !== 0) throw new Error("Seed recusado em banco com usuários; não atualiza contas/dados existentes.");

  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.$transaction(async (tx) => {
    const negocio = await tx.negocio.create({ data: { status: StatusNegocio.ATIVO } });
    const user = await tx.usuario.create({ data: { negocioId: negocio.id, nome, nomeUsuario, email, senhaHash: passwordHash, perfil: PerfilUsuario.ADMINISTRADOR } });
    await tx.auditoriaUsuario.create({ data: { negocioId: negocio.id, alvoId: user.id, evento: "DEVELOPMENT_ADMIN_SEEDED", detalhes: { emailVerificado: false } } });
    return { negocioId: negocio.id, userId: user.id };
  });
  await issueOtp(email, created.negocioId, created.userId, FinalidadeOtp.VERIFICAR_EMAIL);
  console.log("Usuário de desenvolvimento criado como não verificado. Nenhuma credencial/código foi impresso.");
}

main().catch((error: unknown) => {
  console.error("Falha no seed:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
