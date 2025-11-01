import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const keywords = [
  "chili recipe",
  "chicken noodle soup",
  "soup recipes",
  "white chicken chili",
  "lasagna soup",
  "potato soup",
  "apple crisp",
  "pumpkin bread",
  "pumpkin muffins",
  "fall desserts",
  "cookie recipes",
  "chocolate chip cookies",
  "cookies",
  "meatloaf",
  "meatloaf recipes",
  "crockpot recipes",
  "crockpot chicken recipes",
  "dinner recipes",
  "easy dinner recipes",
  "chicken recipes",
  "healthy dinner recipes",
  "charcuterie board",
  "dinner ideas",
];

export async function GET() {
  const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
  return NextResponse.json({ keyword: randomKeyword });
}
