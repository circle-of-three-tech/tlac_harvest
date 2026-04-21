// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// ─── Validation schemas ───────────────────────────────────────────────────────

/** Schema for all non-admin users updating their own profile */
const selfUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  noOfSoulsTarget: z.number().int().min(0).optional(),
});

/** Schema for admin updating any user. All fields optional (partial PATCH). */
const adminUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  roles: z
    .array(z.enum(['EVANGELIST', 'FOLLOWUP', 'ADMIN']))
    .min(1, 'At least one role is required')
    .optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  noOfSoulsTarget: z.number().int().min(0).optional(),
});

/** Priority order for deriving the primary role from a roles array */
const ROLE_PRIORITY: Record<string, number> = { ADMIN: 3, FOLLOWUP: 2, EVANGELIST: 1 };

function derivePrimaryRole(roles: string[]): string {
  return roles.reduce((best, r) => (ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[best] ?? 0) ? r : best, roles[0]);
}

// ─── GET /api/users/[id] ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const requestedUserId = params.id;

    // Only allow users to view their own data, admins can view anyone
    if (session.user.role !== 'ADMIN' && userId !== requestedUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
        phone: true,
        gender: true,
        noOfSoulsTarget: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            addedLeads: true,
            assignedLeads: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error(`GET /api/users/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// ─── PATCH /api/users/[id] ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const targetUserId = params.id;
    const userRole = session.user.role;

    // Authorization: only admin can update others, others can only update themselves
    if (userRole !== 'ADMIN' && userId !== targetUserId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();  

    // Use appropriate schema based on user role
    const schema = userRole === 'ADMIN' ? adminUpdateSchema : selfUpdateSchema;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updateData = parsed.data as Record<string, unknown>;

    // If admin is setting roles array, also derive and set the primary role
    if (userRole === 'ADMIN' && Array.isArray(updateData.roles)) {
      updateData.role = derivePrimaryRole(updateData.roles as string[]);
    }

    // Check email uniqueness if email is being updated
    if (updateData.email && updateData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updateData.email as string },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 422 }
        );
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        roles: true,
        phone: true,
        gender: true,
        noOfSoulsTarget: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            addedLeads: true,
            assignedLeads: true,
          },
        },
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(`PATCH /api/users/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// ─── DELETE /api/users/[id] ───────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admins can delete users
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify user exists
    const userToDelete = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            addedLeads: true,
            assignedLeads: true,
          },
        },
      },
    });

    if (!userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Block deletion when user has related leads. addedLeads uses a required
    // FK so Prisma will throw a constraint error at delete time — we surface
    // a clean 409 instead. assignedLeads is optional, but we also require
    // manual reassignment so leads aren't silently orphaned.
    if (userToDelete._count.assignedLeads > 0 || userToDelete._count.addedLeads > 0) {
      const parts: string[] = [];
      if (userToDelete._count.addedLeads > 0) {
        parts.push(`${userToDelete._count.addedLeads} added lead(s)`);
      }
      if (userToDelete._count.assignedLeads > 0) {
        parts.push(`${userToDelete._count.assignedLeads} assigned lead(s)`);
      }
      return NextResponse.json(
        {
          error: 'Cannot delete user with related leads',
          details: `User has ${parts.join(' and ')}. Please reassign them first.`,
        },
        { status: 409 }
      );
    }

    // Delete the user (cascades will handle related records)
    const deleted = await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: 'User deleted successfully',
      deletedUser: {
        id: deleted.id,
        name: deleted.name,
        email: deleted.email,
      },
    });
  } catch (error) {
    console.error(`DELETE /api/users/${params.id} error:`, error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
