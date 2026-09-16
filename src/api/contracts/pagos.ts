export interface PagosApi {
  /** Arma una Stripe Checkout Session y devuelve la URL a la que hay que redirigir. */
  checkout(usuarioId: string, beneficioId: string): Promise<{ url: string }>;
  /** Igual que checkout(), para la primera compra de un plan (los 3 niveles son suscripción mensual). */
  checkoutPlan(usuarioId: string, planId: string): Promise<{ url: string }>;
  /** Cambia el plan de una suscripción YA activa (Nivel 1↔2) — instantáneo, sin redirección. */
  cambiarPlan(usuarioId: string, planId: string): Promise<{ ok: true }>;
  /** Compra/ajusta un add-on. Si es recurrente y ya hay suscripción activa, se ajusta directo
   * (responde `{ ok: true }`, sin `url`); si no, redirige a Checkout (`{ url }`). */
  checkoutAddon(usuarioId: string, addonSlug: string, cantidad: number): Promise<{ url?: string; ok?: true }>;
  /** Quita 1 unidad de un add-on recurrente ya contratado — instantáneo, sin redirección. */
  quitarAddon(usuarioId: string, addonSlug: string): Promise<{ ok: true }>;
  /** URL del Customer Portal de Stripe (actualizar tarjeta, ver facturas reales, cancelar). */
  portal(usuarioId: string): Promise<{ url: string }>;
  /** Confirma una Checkout Session al volver de Stripe, sin esperar al webhook (que en desarrollo
   * local no llega si no corre `stripe listen`) — ver PagosController::verificarCheckout().
   * `ok: false` = el pago todavía no se confirmó del lado de Stripe (no es un error). */
  verificarCheckout(sessionId: string): Promise<{ ok: boolean }>;
}
