import { AppError } from "../utils/errors.js";

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params
    });

    if (!result.success) {
      return next(new AppError(422, result.error.issues.map((i) => i.message).join(", ")));
    }

    req.validated = result.data;
    next();
  };
}
