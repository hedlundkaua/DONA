import { PrismaClient, StatusNegocio } from "@prisma/client";

const prisma = new PrismaClient();
const quarantineId = "00000000-0000-4000-8000-000000000005";
const tables = ["sessoes_usuarios", "auditoria_usuarios", "categorias_nomes_legacy", "categorias_produtos", "produtos", "movimentacoes_estoque", "ajustes_inventario", "clientes", "vendas", "itens_venda", "usuarios"] as const;

async function main() {
  if (process.env.LEGACY_DATASET_OWNER_CONFIRMED !== "YES") throw new Error("Confirme explicitamente LEGACY_DATASET_OWNER_CONFIRMED=YES.");
  if (process.env.LEGACY_EMAIL_VERIFICATION_POLICY !== "trust-existing-email") throw new Error("Defina LEGACY_EMAIL_VERIFICATION_POLICY=trust-existing-email somente após confirmar a política com o titular.");
  const ownerReference = process.env.LEGACY_OWNER_REFERENCE?.trim();
  if (!ownerReference || ownerReference.length > 120) throw new Error("Informe LEGACY_OWNER_REFERENCE (referência de auditoria, sem credenciais).");

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM negocios WHERE id = ${quarantineId}::uuid AND status = 'QUARENTENA'::status_negocio FOR UPDATE`;
    const countRows = await tx.$queryRaw<Array<{ total: bigint }>>`SELECT count(*)::bigint AS total FROM usuarios WHERE negocio_id = ${quarantineId}::uuid`;
    if (countRows[0]?.total === BigInt(0)) throw new Error("Não há contas legadas na quarentena; nada foi alterado.");

    const target = await tx.negocio.create({ data: { status: StatusNegocio.QUARENTENA } });
    await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;

    // Historical actor references were deliberately added NOT VALID to preserve old orphan IDs.
    await tx.$executeRaw`ALTER TABLE auditoria_usuarios DROP CONSTRAINT auditoria_usuarios_negocio_ator_fkey`;
    await tx.$executeRaw`ALTER TABLE auditoria_usuarios DROP CONSTRAINT auditoria_usuarios_negocio_alvo_fkey`;
    await tx.$executeRaw`ALTER TABLE movimentacoes_estoque DROP CONSTRAINT movimentacoes_estoque_negocio_operador_fkey`;
    await tx.$executeRaw`ALTER TABLE ajustes_inventario DROP CONSTRAINT ajustes_inventario_negocio_usuario_fkey`;

    for (const table of tables) {
      // Table names are a compile-time constant; all values remain bound parameters.
      await tx.$executeRawUnsafe(`UPDATE "${table}" SET "negocio_id" = $1::uuid WHERE "negocio_id" = $2::uuid`, target.id, quarantineId);
    }

    await tx.$executeRaw`ALTER TABLE auditoria_usuarios ADD CONSTRAINT auditoria_usuarios_negocio_ator_fkey FOREIGN KEY (negocio_id, ator_id) REFERENCES usuarios(negocio_id, id) ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID`;
    await tx.$executeRaw`ALTER TABLE auditoria_usuarios ADD CONSTRAINT auditoria_usuarios_negocio_alvo_fkey FOREIGN KEY (negocio_id, alvo_id) REFERENCES usuarios(negocio_id, id) ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID`;
    await tx.$executeRaw`ALTER TABLE movimentacoes_estoque ADD CONSTRAINT movimentacoes_estoque_negocio_operador_fkey FOREIGN KEY (negocio_id, operador_id) REFERENCES usuarios(negocio_id, id) ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID`;
    await tx.$executeRaw`ALTER TABLE ajustes_inventario ADD CONSTRAINT ajustes_inventario_negocio_usuario_fkey FOREIGN KEY (negocio_id, usuario_responsavel_id) REFERENCES usuarios(negocio_id, id) ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID`;

    const verified = await tx.usuario.updateMany({ where: { negocioId: target.id, emailVerificadoEm: null }, data: { emailVerificadoEm: new Date() } });
    const legacyUsers = await tx.usuario.findMany({ where: { negocioId: target.id }, select: { id: true } });
    for (const user of legacyUsers) {
      await tx.auditoriaUsuario.create({ data: {
        negocioId: target.id,
        alvoId: user.id,
        evento: "LEGACY_EMAIL_VERIFIED",
        detalhes: { policy: "trust-existing-email", ownerReference, source: "explicit-legacy-claim", sessionRevocation: "all pre-migration sessions revoked" },
      } });
    }
    await tx.auditoriaUsuario.create({ data: {
      negocioId: target.id,
      evento: "LEGACY_TENANT_CLAIMED",
      detalhes: { ownerReference, emailVerificationPolicy: "trust-existing-email", verifiedUsers: verified.count, sourceTenant: "quarantine" },
    } });
    await tx.negocio.update({ where: { id: target.id }, data: { status: StatusNegocio.ATIVO } });
    return { tenant: target.id, users: legacyUsers.length, verified: verified.count };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 60_000 });

  console.log(`Importação legada concluída: ${result.users} usuários no novo negócio; ${result.verified} emails tratados pela política explicitamente confirmada. Referência: ${ownerReference}.`);
}

main().catch((error: unknown) => {
  console.error("Falha ao reivindicar dados legados:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
