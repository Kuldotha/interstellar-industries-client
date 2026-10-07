import signer from '../../worker/index.mjs';
export const onRequest=context=>signer.fetch(context.request,context.env);
