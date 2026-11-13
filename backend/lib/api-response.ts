/**
 * Utilitários de resposta da API
 * Padroniza o formato JSON de sucesso e erro
 */
import { NextResponse } from "next/server";

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(error: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function forbidden(error = "Acesso negado."): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 403 });
}

export function notFound(resource = "Recurso"): NextResponse<ApiResponse> {
  return NextResponse.json(
    { success: false, error: `${resource} não encontrado.` },
    { status: 404 }
  );
}

export function conflict(error: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 409 });
}

export function unprocessable(error: string): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status: 422 });
}

export function serverError(error: unknown): NextResponse<ApiResponse> {
  if (error && typeof error === "object" && "digest" in error && error.digest === "NEXT_PRERENDER_INTERRUPTED") {
    throw error;
  }
  console.error("[API Error]", error);
  return NextResponse.json(
    { success: false, error: "Erro interno do servidor." },
    { status: 500 }
  );
}
