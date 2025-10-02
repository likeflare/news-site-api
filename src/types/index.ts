export interface Author {
  id: string;
  name: string;
  slug: string;
  title?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  website?: string;
  twitter_url?: string;
  linkedin_url?: string;
  email?: string;
  join_date?: string;
  article_count: number;
  follower_count: number;
  award_count: number;
  expertise: string[];
  created_at: string | number;
  updated_at: string | number;
  join_date_int?: number;
  created_at_int?: number;
  updated_at_int?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  created_at: string | number;
  updated_at: string | number;
  created_at_int?: number;
  updated_at_int?: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  article_count: number;
  created_at: string | number;
  updated_at: string | number;
  created_at_int?: number;
  updated_at_int?: number;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  tldr?: string;
  image_url?: string;
  author_id: string;
  category_id?: string;
  read_time: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_featured: boolean;
  is_published: boolean;
  published_at: string | number;
  created_at: string | number;
  updated_at: string | number;
  published_at_int?: number;
  created_at_int?: number;
  updated_at_int?: number;
  author?: Author;
  category?: Category;
  tags?: Tag[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  provider: string;
  provider_id: string;
  created_at: string | number;
  updated_at: string | number;
  created_at_int?: number;
  updated_at_int?: number;
}

export interface Comment {
  id: string;
  article_id: string;
  parent_id?: string;
  author_name: string;
  author_email?: string;
  author_avatar?: string;
  user_id?: string;
  content: string;
  like_count: number;
  is_approved: boolean;
  created_at: string | number;
  updated_at: string | number;
  created_at_int?: number;
  updated_at_int?: number;
  isLikedByUser?: boolean;
  user?: User;
  replies?: Comment[];
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  is_active: boolean;
  subscribed_at: string | number;
  unsubscribed_at?: string | number;
  subscribed_at_int?: number;
  unsubscribed_at_int?: number;
}

// Request/Response types
export interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}
