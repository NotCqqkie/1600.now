
export interface Env {
  UPSTREAM_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Use the upstream URL from environment variables
    const upstream = env.UPSTREAM_URL || 'https://htefdhlhhrgtxzudeovr.supabase.co';
    const upstreamUrl = new URL(upstream);

    // Construct the new URL
    const newUrl = new URL(url.pathname + url.search, upstreamUrl);

    // Create a new request with the updated URL
    // We clone the original request to preserve body, method, etc.
    const newRequest = new Request(newUrl.toString(), new Request(request));

    // Ensure the Host header matches the upstream
    newRequest.headers.set('Host', upstreamUrl.hostname);

    try {
      const response = await fetch(newRequest);
      
      // Return the response as is
      // If you need to handle CORS locally, you would intercept headers here.
      // But Supabase typically handles CORS based on your dashboard settings.
      return response;
    } catch (e) {
      return new Response('Proxy Error', { status: 500 });
    }
  },
};
