import { z, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

// Comment validation schemas
export const createCommentSchema = z.object({
  articleId: z.string().min(1, "Article ID is required"),
  content: z.string()
    .min(1, "Comment content is required")
    .max(5000, "Comment must be less than 5000 characters"),
  parentId: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string()
    .min(1, "Comment content is required")
    .max(5000, "Comment must be less than 5000 characters").optional(),
  is_approved: z.boolean().optional(),
});

// Article validation schemas
export const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  excerpt: z.string().max(500).optional(),
  content: z.string().optional(),
  tldr: z.string().max(1000).optional(),
  image_url: z.string().url().optional(),
  author_id: z.string().min(1),
  category_id: z.string().optional(),
  read_time: z.string().min(1),
  is_featured: z.boolean().optional(),
  is_published: z.boolean().optional(),
});

export const updateArticleSchema = createArticleSchema.partial();

// Middleware to validate request body
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          details: error.issues,
        });
      }
      next(error);
    }
  };
}

// Middleware to validate query parameters
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: error.issues,
        });
      }
      next(error);
    }
  };
}
