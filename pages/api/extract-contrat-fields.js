// Alias route (FR spelling) to the existing extract-contract-fields handler.
// Keep config inline so Next can statically parse it.
import handler from "./extract-contract-fields.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

export default handler;
