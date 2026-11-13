import bcrypt from "bcryptjs";
import { FinalidadeOtp, PerfilUsuario, PrismaClient, StatusNegocio } from "@prisma/client";
import { issueOtp } from "../lib/otp";
import { emailProviderConfigured } from "../lib/auth-email";

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const nomeUsuario = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!nome || !nomeUsuario || !email || !senha) throw new Error("Configure BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no processo.");
  if (nome.length > 150 || !/^[a-z0-9._-]{3,50}$/.test(nomeUsuario) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Dados iniciais inválidos.");
  if (senha.length < 12 || Buffer.byteLength(senha, "utf8") > 72) throw new Error("A senha deve ter ao menos 12 caracteres e no máximo 72 bytes.");

  if (!emailProviderConfigured()) throw new Error("Email provider not configured; no database changes made.");
  if (await prisma.usuario.count() !== 0) throw new Error("Bootstrap recusado: já existem usuários. Não atribua dados legados automaticamente; siga docs/multi-tenancy-auth.md.");

  const senhaHash = await bcrypt.hash(senha, 12);
  const result = await prisma.$transaction(async (tx) => {
    const negocio = await tx.negocio.create({ data: { status: StatusNegocio.ATIVO } });
    const admin = await tx.usuario.create({ data: { negocioId: negocio.id, nome, nomeUsuario, email, senhaHash, perfil: PerfilUsuario.ADMINISTRADOR } });
    await tx.auditoriaUsuario.create({ data: { negocioId: negocio.id, alvoId: admin.id, evento: "INITIAL_ADMIN_BOOTSTRAPPED", detalhes: { perfil: admin.perfil, emailVerificado: false } } });
    return { negocioId: negocio.id, id: admin.id };
  });
  await issueOtp(email, result.negocioId, result.id, FinalidadeOtp.VERIFICAR_EMAIL);
  console.log("Administrador inicial criado como não verificado. Se o provedor de e-mail estiver configurado, instruções foram enviadas; nenhum segredo foi impresso.");
}

main().catch((error: unknown) => {
  console.error("Falha no bootstrap:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
