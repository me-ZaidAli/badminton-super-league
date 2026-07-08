import { NextResponse } from "next/server";

const DEV_USER = {
  id: 1,
  fullName: "Dev Admin",
  email: "dev@bsl.local",
  role: "OWNER",
  secondaryRoles: [],
  accountStatus: "APPROVED",
  profilePictureUrl: null,
  nickname: null,
};

export async function GET() {
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.json(DEV_USER);
  }
  return NextResponse.json(null, { status: 401 });
}
