export type RequestOptions = RequestInit & { duplex?: 'half' }
export type Transport = (url: string, options: RequestOptions) => Promise<Response>
