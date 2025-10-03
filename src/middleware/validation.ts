import { z, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";

// Comment validation schemas
export const createCommentSchema = z.object({
  articleId: z.string().min(1, "Article ID is required"),
  content: z.string()
    .min(1, "Comment content is required")
    .max(5000, "Comment must be less than 5000 characters"),
  parentId: z.string().optional().nullable(),
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

// Query parameter validation schemas
export const articlesQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/, "limit must be a positive number").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a positive number").optional(),
  categorySlug: z.string().optional(),
  authorSlug: z.string().optional(),
  tagSlug: z.string().optional(),
  featured: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

export const commentsQuerySchema = z.object({
  articleId: z.string().min(1, "articleId is required"),
  userEmail: z.string().email().optional(),
});

export const relatedQuerySchema = z.object({
  articleId: z.string().min(1, "articleId is required"),
  limit: z.string().regex(/^\d+$/, "limit must be a positive number").optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, "search query is required"),
  limit: z.string().regex(/^\d+$/, "limit must be a positive number").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a positive number").optional(),
});

export const adminListQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/, "limit must be a positive number").optional(),
  offset: z.string().regex(/^\d+$/, "offset must be a positive number").optional(),
  approved: z.enum(["true", "false"]).optional(),
  published: z.enum(["true", "false"]).optional(),
});

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
