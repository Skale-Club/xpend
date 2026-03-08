export type ChatErrorType =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'offline';

export type ChatErrorSurface = 'chat' | 'api' | 'database' | 'settings';
export type ChatErrorCode = `${ChatErrorType}:${ChatErrorSurface}`;

function getStatusByType(type: ChatErrorType): number {
  switch (type) {
    case 'bad_request':
      return 400;
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'rate_limit':
      return 429;
    case 'offline':
      return 503;
    default:
      return 500;
  }
}

function getMessageByCode(code: ChatErrorCode): string {
  switch (code) {
    case 'bad_request:api':
      return 'The request could not be processed. Please check your input and try again.';
    case 'bad_request:settings':
      return 'Gemini API key not configured. Please add your API key in Settings.';
    case 'rate_limit:chat':
      return 'You have exceeded the allowed number of chat requests. Please try again later.';
    case 'offline:chat':
      return 'We are having trouble processing your message right now. Please try again.';
    default:
      return 'Something went wrong. Please try again later.';
  }
}

export class ChatApiError extends Error {
  readonly type: ChatErrorType;
  readonly surface: ChatErrorSurface;
  readonly statusCode: number;

  constructor(code: ChatErrorCode, cause?: string) {
    super(getMessageByCode(code));
    const [type, surface] = code.split(':') as [ChatErrorType, ChatErrorSurface];
    this.type = type;
    this.surface = surface;
    this.statusCode = getStatusByType(type);
    this.cause = cause;
  }

  toResponse(): Response {
    return Response.json(
      {
        code: `${this.type}:${this.surface}`,
        error: this.message,
      },
      { status: this.statusCode }
    );
  }
}