import { createCompositionRoot } from '@app/composition-root';

export const prerender = true;

export async function GET(): Promise<Response> {
  const items = await createCompositionRoot().getCatalogClientData.execute();
  return new Response(JSON.stringify(items), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
