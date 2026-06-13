import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const protectedPathPatterns = [
  /^\/dashboard(?:\/.*)?$/,
  /^\/search(?:\/.*)?$/,
  /^\/beneficiary(?:\/.*)?$/,
  /^\/manage(?:\/.*)?$/,
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const isProtectedPath = protectedPathPatterns.some((pattern) =>
    pattern.test(request.nextUrl.pathname),
  );

  if (isProtectedPath && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
