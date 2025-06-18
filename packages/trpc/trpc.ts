import type { User } from "@supabase/auth-helpers-nextjs";
import { createPagesServerClient } from "@supabase/auth-helpers-nextjs";
import { initTRPC, TRPCError } from "@trpc/server";
import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
import superjson from "superjson";
import { ZodError } from "zod";

import { prisma } from "@refeed/db";

interface CreateContextOptions {
  user: User | null;
}

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    user: opts.user,
    prisma,
  };
};

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const supabase = createPagesServerClient(opts);

  // React Native will pass their token through headers,
  // browsers will have the session cookie set
  const token = opts.req.headers.authorization;

  let user = null;

  try {
    const userResult = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();

    user = userResult.data.user;
  } catch (error) {
    // If there's an error getting the user, we'll just set user to null
    // This will result in a 401 UNAUTHORIZED error, which is the expected behavior
    console.error("Error getting user from Supabase:", error);
  }

  return createInnerTRPCContext({
    user,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `user` as non-nullable
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
