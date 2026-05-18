import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { listManagedAppUsers, setAppUserActive } from "@/lib/app-users";

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    return NextResponse.json({ users: await listManagedAppUsers() });
  } catch (error) {
    console.error("Admin users fetch error:", error);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const body = (await request.json()) as {
      id?: unknown;
      active?: unknown;
    };
    const id = typeof body.id === "string" ? body.id : "";
    const active =
      typeof body.active === "boolean" ? body.active : undefined;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }
    if (active === undefined) {
      return NextResponse.json(
        { error: "Active status is required" },
        { status: 400 }
      );
    }

    if (user?.id === id && !active) {
      return NextResponse.json(
        { error: "현재 로그인한 관리자 계정은 비활성화할 수 없습니다." },
        { status: 400 }
      );
    }

    await setAppUserActive(id, active);
    return NextResponse.json({ users: await listManagedAppUsers() });
  } catch (error) {
    console.error("Admin users update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update user",
      },
      { status: 400 }
    );
  }
}
