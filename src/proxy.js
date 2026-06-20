import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Define the public and protected routes
const publicRoutes = ['/login', '/api/auth/login'];
const adminOnlyRoutes = ['/dashboard', '/prestamos', '/usuarios', '/reportes', '/api/reportes'];
const collaboratorAllowedRoutes = [
  '/clientes', 
  '/cobros', 
  '/recibo',
  '/recordatorios',
  '/api/clientes', 
  '/api/buscar', 
  '/api/pagos',
  '/api/prestamos',
  '/api/notificaciones',
  '/api/auth/logout', 
  '/api/auth/me'
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Static files and internal Next.js routes are public
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  // Get the token from cookies
  const token = request.cookies.get('auth_token')?.value;

  if (!token && !isPublicRoute) {
    // Redirect to login if unauthenticated and trying to access protected route
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (token) {
    try {
      const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_12345');
      const { payload } = await jwtVerify(token, secretKey);

      // If user is logged in and trying to access login page, redirect to their default home
      if (pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = payload.rol === 'admin' ? '/dashboard' : '/clientes';
        return NextResponse.redirect(url);
      }

      // If root page, redirect based on role
      if (pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = payload.rol === 'admin' ? '/dashboard' : '/clientes';
        return NextResponse.redirect(url);
      }

      // Role-based access control
      if (payload.rol === 'colaborador') {
        const isAdminRoute = adminOnlyRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));
        
        if (isAdminRoute) {
          // Redirect collaborators trying to access admin routes to /clientes
          const url = request.nextUrl.clone();
          url.pathname = '/clientes';
          return NextResponse.redirect(url);
        }

        // Additional API protection for collaborators
        if (pathname.startsWith('/api/')) {
          // Allow reading APIs that they have access to
          const isAllowedApi = collaboratorAllowedRoutes.some(route => pathname.startsWith(route));
          if (!isAllowedApi) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
          }

          // Restrict DELETE for clients
          if (pathname.startsWith('/api/clientes/') && request.method === 'DELETE') {
            return NextResponse.json({ error: 'No autorizado para eliminar clientes' }, { status: 403 });
          }
        }
      }

    } catch (error) {
      // Invalid token, clear cookie and redirect to login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const response = NextResponse.redirect(url);
      response.cookies.delete('auth_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
