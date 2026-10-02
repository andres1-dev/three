export interface HttpRequest {
  method: string;
  url: string;
  headers: Headers;
  body?: any;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body?: any;
}

export class HttpAdapter {
  static jsonResponse(data: any, status = 200): HttpResponse {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      },
      body: data,
    };
  }

  static errorResponse(message: string, status = 400): HttpResponse {
    return this.jsonResponse({ error: message }, status);
  }

  static corsResponse(): HttpResponse {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      },
      body: 'ok',
    };
  }

  static async parseRequest(req: Request): Promise<HttpRequest> {
    const body = req.method !== 'GET' && req.method !== 'DELETE'
      ? await req.json().catch(() => null)
      : undefined;

    return {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    };
  }

  static toResponse(response: HttpResponse): Response {
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: response.headers,
    });
  }
}
