//@ts-ignore

export const revalidate = 0;

import { subSections } from "@/libs/Section";
import axios from "axios";
import slugify from "slugify";
import { CONVERT } from "../humanizee/Convert";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import UPLOAD from "../upload2/Upload";

const prisma = new PrismaClient().$extends(withAccelerate());

let timestorun = 1;
let successCount = 0;
let failedCount = 0;

const REGEX = /\["(\bhttps?:\/\/[^"]+)",(\d+),(\d+)\],null/g;

const boardMap: Record<string, string> = {
  "Easy Recipes": "1047298157036883641",
  "Quick & Simple Meals": "1047298157036883654",
  "Healthy Recipes": "1047298157036883655",
  "Comfort Food": "1047298157036883656",
  "Budget-Friendly Recipes": "1047298157036883657",
  "Breakfast Recipes": "1047298157036883658",
  "Lunch Ideas": "1047298157036756537",
  "Dinner Recipes": "1047298157036883662",
  "Snacks & Appetizers": "1047298157036883663",
  "Meal Prep Recipes": "1047298157036883664",
  "One-Pot & One-Pan Meals": "1047298157036883665",
  "30-Minute Meals": "1047298157036883666",
  Desserts: "1047298157036883667",
  "Cakes & Cupcakes": "1047298157036883668",
  "Cookies & Bars": "1047298157036883669",
  "Baking Recipes": "1047298157036883670",
  "No-Bake Desserts": "1047298157036883671",
  "Chocolate Desserts": "1047298157036883672",
  "Chicken Recipes": "1047298157036640720",
  "Beef & Meat Recipes": "1047298157036883674",
  "Seafood & Fish Recipes": "1047298157036883675",
  "Vegetarian Recipes": "1047298157036883676",
  "Vegan Recipes": "1047298157036640710",
  "Pasta Recipes": "1047298157036883679",
  "Rice & Grain Dishes": "1047298157036883680",
  "Vegetable Recipes": "1047298157036883681",
  "Fruit-Based Recipes": "1047298157036883682",
  "Indian Recipes": "1047298157036883683",
  "Italian Recipes": "1047298157036883684",
  "Mexican Recipes": "1047298157036883685",
  "Chinese Recipes": "1047298157036883686",
  "American Classics": "1047298157036883687",
  "Mediterranean Recipes": "1047298157036883688",
  "Thai Recipes": "1047298157036883689",
  "Japanese Recipes": "1047298157036883690",
  "Middle Eastern Recipes": "1047298157036883691",
  "Holiday & Festive Recipes": "1047298157036883692",
  "Party Food Ideas": "1047298157036883693",
  "Summer Recipes": "1047298157036883694",
  "Winter Recipes": "1047298157036883695",
  "Spring Recipes": "1047298157036883696",
  "Fall Recipes": "1047298157036883697",
  "BBQ & Grilling Recipes": "1047298157036883698",
  "Air Fryer Recipes": "1047298157036883699",
  "Instant Pot Recipes": "1047298157036883700",
  "Slow Cooker Recipes": "1047298157036883701",
  "Baking & Oven Recipes": "1047298157036883702",
  "No-Cook Recipes": "1047298157036883703",
  "Smoothies & Juices": "1047298157036883704",
  "Coffee & Tea Recipes": "1047298157036883705",
  "Mocktails & Drinks": "1047298157036883706",
};

function getBoardId(boardName: string) {
  return boardMap[boardName] || null;
}

// Sleep helper
function sleep(ms: any) {
  // console.log(`⏳ Waiting ${ms / 1000 / 60} min before next request...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Converts unicode escapes to normal strings
const unicodeToString = (content: any) =>
  content.replace(/\\u[\dA-F]{4}/gi, (match: any) =>
    String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16))
  );

// Scrape image URLs from Google Images
async function fetchImageUrls(searchTerm: string) {
  if (!searchTerm || typeof searchTerm !== "string")
    throw new TypeError("searchTerm must be a string.");

  console.log(`🔍 Scraping images for: ${searchTerm}`);

  // Dynamically import puppeteer-extra and the stealth plugin to avoid Next.js static analysis errors
  const { default: puppeteer } = await import("puppeteer-extra");
  const { default: StealthPlugin } = await import("puppeteer-extra-plugin-stealth");
  
  // @ts-ignore
  if (!puppeteer._isStealthLoaded) {
    puppeteer.use(StealthPlugin());
    // @ts-ignore
    puppeteer._isStealthLoaded = true;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // Using DuckDuckGo as it is more reliable for scraping and returns high-quality results
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm)}&iax=images&ia=images`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a bit for the images to render
    await new Promise(r => setTimeout(r, 2000));

    const results = await page.evaluate(() => {
      const items: { url: string; alt: string }[] = [];
      const imgs = document.querySelectorAll('img.tile--img__img, img[src*="external-content.duckduckgo.com"]');
      
      imgs.forEach(img => {
        const src = (img as HTMLImageElement).src;
        if (src && src.startsWith('http')) {
          items.push({
            url: src,
            alt: (img as HTMLImageElement).alt || ''
          });
        }
      });

      return items;
    });

    console.log(`✅ Found ${results.length} images from DDG`);
    return results;
  } catch (error) {
    console.error("Error fetching image URLs:", error);
    return [];
  } finally {
    await browser.close();
  }
}

// Get a valid image URL
async function image(query: string) {
  try {
    const results = await fetchImageUrls(query);
    
    if (!results || results.length === 0) {
       console.log(`⚠️ No image results found for query: ${query}`);
       return null;
    }

    const url = results.find((item: any) => {
      const isHttps = item.url.startsWith("https:");
      const isNotFromBlockedSource =
        !/(Shutterstock|Instagram|Facebook|Stockcake|TikTok|GettyImages|AdobeStock|iStock|Alamy|123RF|EnvatoElements|Depositphotos|Dreamstime|Pond5|CanvaPro)/i.test(
          item.url
        );
      
      // Some Google results are base64, we want real URLs
      const isNotData = !item.url.startsWith('data:');
      
      // Heuristic: usually real image URLs end with an extension or are from reliable CDNs
      const hasImageExtension = /\.(jpe?g|png|gif|webp|bmp)/i.test(item.url);
      const isFromReliableCDN = item.url.includes('gstatic.com') || 
                                item.url.includes('googleusercontent.com') || 
                                item.url.includes('bing.net') || 
                                item.url.includes('duckduckgo.com');

      return isHttps && isNotFromBlockedSource && isNotData && (hasImageExtension || isFromReliableCDN);
    });

    return url;
  } catch (e) {
    console.error("Error in image function:", e);
    return null;
  }
}

// ------------------- MAIN PROCESS -------------------

// async function Upload2(randomKeyword) {
//   async function startProcess() {
//     try {
//       const blogs = await UPLOAD({ query: randomKeyword });
//       const covertedBlog = JSON.parse(blogs);

//       // Validation
//       if (
//         covertedBlog.pageTitle.includes("[") ||
//         covertedBlog.pageTitle.includes("]") ||
//         covertedBlog.pageTitle.includes("Image Query")
//       )
//         throw new Error("Invalid title");

//       covertedBlog.recipeDescription.detailedDescription.forEach((item) => {
//         if (
//           item.description.includes("[") ||
//           item.description.includes("]") ||
//           item.description.includes("Image Query")
//         )
//           throw new Error("Invalid description");
//       });

//       // Main image
//       if (!covertedBlog.imageQuery || covertedBlog.imageQuery === "null") {
//         console.log("❌ Missing image query — retrying in 2 min...");
//         await sleep(30000);
//         return await startProcess();
//       }

//       let mainImg = await image(covertedBlog.imageQuery);
//       if (!mainImg?.url) {
//         console.log("❌ No valid image found for:", covertedBlog.imageQuery);
//         console.warn("⚠️ Main image failed — retrying with 'food' suffix...");
//         mainImg = await image(`${covertedBlog.imageQuery} food`);

//         if (!mainImg?.url) {
//           console.warn(
//             "⚠️ Main image failed again — retrying with 'recipe dish' suffix..."
//           );
//           mainImg = await image(`${covertedBlog.imageQuery} recipe dish`);
//           if (!mainImg?.url) throw new Error("Main image fetch failed");
//         }
//       }
//       // Step images
//       const results = await Promise.all(
//         covertedBlog.recipeDescription.detailedDescription.map(async (item) => {
//           if (!item.imageQuery || item.imageQuery === "null") {
//             return {
//               description: item.description,
//               url: "null",
//               alt: "null",
//             };
//           }
//           let stepImg = await image(item.imageQuery);
//           if (!stepImg?.url) {
//             console.log("❌ No step image found for:", item.imageQuery);
//             console.warn("⚠️ Retrying with 'recipe step' suffix...");
//             stepImg = await image(`${item.imageQuery} recipe step`);

//             if (!stepImg?.url) {
//               console.warn(
//                 "⚠️ Step image failed again — retrying with 'food cooking step' suffix..."
//               );
//               stepImg = await image(`${item.imageQuery} food cooking step`);
//               if (!stepImg?.url) throw new Error("Step image fetch failed");
//             }
//           }
//           return {
//             description: item.description,
//             url: stepImg?.url || "null",
//             alt: item.imageQuery,
//           };
//         })
//       );

//       // Upload to DB
//       const reqres = {
//         section: "Others",
//         title: slugify(covertedBlog.pageTitle),
//         imagealt: covertedBlog.imageQuery,
//         imageurl: mainImg.url,
//         subsection: "Others",
//         subsubsection: "Others",
//         content: results,
//         instructions: covertedBlog.instructions,
//         recipedetails: covertedBlog.recipeDetails,
//         recipedescription: covertedBlog.recipeDescription.shortDescription,
//         author: covertedBlog.author,
//         quote: covertedBlog.quote,
//         seo: covertedBlog.seo,
//         faq: covertedBlog.faq,
//         equipments: covertedBlog.equipments,
//         slug: `Others/Others/Others/${slugify(covertedBlog.pageTitle)}`,
//       };
//       // return { success: true, data: reqres };

//       console.log(`title`, slugify(covertedBlog.pageTitle));
//       const newBlog = await prisma.foodBlogs.create({ data: reqres });

//       // ✅ Construct the response object
//       const domain = process.env.NEXT_PUBLIC_BASE_API_URL; // change this to your domain
//       const author = covertedBlog.author || "Admin";
//       const url = `${domain}/Others/Others/Others/${slugify(
//         covertedBlog.pageTitle
//       )}`;
//       const id = slugify(covertedBlog.pageTitle);

//       const responseObject = {
//         title: DeSlugify(newBlog.title),
//         id: url,
//         link: url,
//         description: newBlog.recipedescription,
//         author: [author],
//         contributor: [author],
//         date: new Date(Date.now() - 60 * 60 * 1000), // 1 hour before now
//         category: [
//           { name: id },
//           { name: newBlog.subsection },
//           { name: newBlog.subsubsection },
//         ],
//         image: {
//           type: "image/png",
//           url:
//             domain +
//             `/api/og?title=${encodeURIComponent(
//               newBlog.title
//             )}&cover=${encodeURIComponent(newBlog.imageurl)}`,
//         },
//         randomKeyword: randomKeyword,
//       };

//       console.log("✅ UPLOAD SUCCESSFUL:", newBlog.title);
//       failedCount = 0;
//       return responseObject;

//       // successCount++;
//       // if (successCount < timestorun) {
//       //   await sleep(120000);
//       //   return await startProcess();
//       // } else {
//       //   console.log("🎉 All uploads completed successfully!");
//       //   return "Success";
//       // }
//     } catch (error) {
//       console.error("⚠️ Error occurred, retrying...", error);
//       failedCount++;
//       console.log("failed count", failedCount);
//       if (failedCount >= 2) {
//         throw new Error("Process failed twice, aborting.");
//         // return null;
//       } else {
//         await sleep(30000);
//         return await startProcess();
//       }
//     } finally {
//       await prisma.$disconnect();
//     }
//   }

async function Upload2(randomKeyword: any) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(
        `🚀 Attempt ${attempt} started for keyword: ${randomKeyword}`
      );

      const blogs = await UPLOAD({ query: randomKeyword });
      //@ts-ignore
      const covertedBlog = JSON.parse(blogs);

      // ---------- Validation ----------
      if (
        covertedBlog.pageTitle.includes("[") ||
        covertedBlog.pageTitle.includes("]") ||
        covertedBlog.pageTitle.includes("Image Query")
      ) {
        throw new Error("Invalid title");
      }

      //@ts-ignore
      covertedBlog.recipeDescription.detailedDescription.forEach((item) => {
        if (
          item.description.includes("[") ||
          item.description.includes("]") ||
          item.description.includes("Image Query")
        ) {
          throw new Error("Invalid description");
        }
      });

      // ---------- Main Image ----------
      if (!covertedBlog.imageQuery || covertedBlog.imageQuery === "null") {
        console.log("❌ Missing image query — retrying in 30 sec...");
        await sleep(30000);
        continue; // skip to the next attempt early
      }

      let mainImg = await image(covertedBlog.imageQuery);
      if (!mainImg?.url) {
        console.warn("⚠️ Main image failed — retrying with suffix...");
        mainImg = await image(`${covertedBlog.imageQuery} food`);
        if (!mainImg?.url)
          mainImg = await image(`${covertedBlog.imageQuery} recipe dish`);
        if (!mainImg?.url) {
          throw new Error("Main image fetch failed");
        }
      }

      // ---------- Step Images ----------
      const results = await Promise.all(
        //@ts-ignore
        covertedBlog.recipeDescription.detailedDescription.map(async (item) => {
          if (!item.imageQuery || item.imageQuery === "null") {
            return { description: item.description, url: "null", alt: "null" };
          }

          let stepImg = await image(item.imageQuery);
          if (!stepImg?.url) {
            console.warn("⚠️ Retrying step image with suffix...");
            stepImg = await image(`${item.imageQuery} recipe step`);
            if (!stepImg?.url)
              stepImg = await image(`${item.imageQuery} food cooking step`);
            if (!stepImg?.url) {
              throw new Error("Step image fetch failed");
            }
          }

          return {
            description: item.description,
            url: stepImg?.url || "null",
            alt: item.imageQuery,
          };
        })
      );

      // ---------- Upload to DB ----------
      const reqres = {
        section: "Others",
        title: slugify(covertedBlog.pageTitle),
        imagealt: covertedBlog.imageQuery,
        imageurl: mainImg.url,
        subsection: "Others",
        subsubsection: "Others",
        content: results,
        instructions: covertedBlog.instructions,
        recipedetails: covertedBlog.recipeDetails,
        recipedescription: covertedBlog.recipeDescription.shortDescription,
        author: covertedBlog.author,
        quote: covertedBlog.quote,
        seo: covertedBlog.seo,
        faq: covertedBlog.faq,
        equipments: covertedBlog.equipments,
        slug: `Others/Others/Others/${slugify(covertedBlog.pageTitle)}`,
      };

      console.log(`📝 Creating DB entry for:`, slugify(covertedBlog.pageTitle));
      const newBlog = await prisma.foodBlogs.create({ data: reqres });

      // ---------- Construct Response ----------
      const domain = process.env.NEXT_PUBLIC_BASE_API_URL;
      const author = covertedBlog.author || "Admin";
      const url = `${domain}/Others/Others/Others/${slugify(
        covertedBlog.pageTitle
      )}`;
      const id = slugify(covertedBlog.pageTitle);

      const responseObject = {
        title: DeSlugify(newBlog.title),
        id: url,
        link: url,
        description: newBlog.recipedescription,
        author: [author],
        contributor: [author],
        date: new Date(Date.now() - 60 * 60 * 1000),
        category: [
          { name: id },
          { name: newBlog.subsection },
          { name: newBlog.subsubsection },
        ],
        image: {
          type: "image/png",
          url:
            domain +
            `/api/og?title=${encodeURIComponent(
              newBlog.title
            )}&cover=${encodeURIComponent(newBlog.imageurl)}`,
        },
        randomKeyword,
        boardName: covertedBlog.seo.primaryKeywords[0],
        boardId: getBoardId(covertedBlog.seo.primaryKeywords[0]),
      };

      console.log("✅ Upload successful:", newBlog.title);
      return responseObject; // **Important**: return here — exit the loop and function on success
    } catch (err) {
      //@ts-ignore
      console.warn(`⚠️ Attempt ${attempt} failed:`, err.message);

      if (attempt === 3) {
        console.error("❌ Process failed thrice — aborting.");
        throw err; // **Important**: throw the error to propagate it out of the function
        // return new Response(JSON.stringify({ error: "Process failed" }), {
        //   status: 500,
        //   headers: { "Content-Type": "application/json" },
        // });
      }

      console.log("⏳ Retrying in 30 seconds...");
      await sleep(30000);
    } finally {
      await prisma.$disconnect();
    }
  }

  // **Optional**: If loop ends without return or throw, you might throw to signal something went wrong
  throw new Error("Upload2 failed after all attempts");
}

//   // ✅ Important: return the awaited promise chain
//   const result = await startProcess();
//   return result; // ensures the response propagates up
// }

// ------------------- API Route -------------------

export async function GET() {
  try {
    console.warn(
      "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"
    );
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formattedDate = today.toLocaleDateString("en-US", options);

    console.log(formattedDate); // Output̀: "September 19, 2024"
    // const { searchParams } = new URL(req.url);
    // const query = searchParams.get("q");
    // console.log(`📦 Received query:`, query);
    // Parse the JSON array from env
    // const keywords = JSON.parse(process.env.NEXT_PUBLIC_KEYWORDS || "[]");
    // const envVar = process.env.NEXT_PUBLIC_KEYWORDS || "[]";
    // let keywords: string[] = [];

    // try {
    //   // Try parsing normally first
    //   keywords = JSON.parse(envVar);
    // } catch {
    //   // If it fails, try unescaping and parsing again
    //   try {
    //     const cleaned = envVar
    //       .replace(/^"+|"+$/g, "") // remove surrounding quotes
    //       .replace(/\\"/g, '"'); // unescape quotes
    //     keywords = JSON.parse(cleaned);
    //   } catch (err) {
    //     console.error("⚠️ Failed to parse even after cleaning:", err);
    //     throw new Error("Invalid NEXT_PUBLIC_KEYWORDS format");
    //   }
    // }

    const keywords = process.env.NEXT_PUBLIC_KEYWORDS?.split("|") || [];

    if (!Array.isArray(keywords) || keywords.length === 0) {
      throw new Error("NEXT_PUBLIC_KEYWORDS is empty or invalid");
    }

    // Pick a random keyword
    const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    console.log(`📦 Selected random keyword:`, randomKeyword);

    // Use your Upload2 logic
    const data = await Upload2(randomKeyword);

    console.warn(
      "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"
    );
    // return Response.json(data);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // console.error("❌ API ERROR:", error);
    // const err = error as Error;
    // const message = err.message || "Unknown error";
    // const stackLine = err.stack ? err.stack.split("\n")[1].trim() : "";
    // console.error(
    // `❌ API ERROR: ${message}${stackLine ? ` at ${stackLine}` : ""}`
    // );
    //@ts-ignore
    // return Response.json({ error: error?.message || "Something went wrong" });
    console.warn(
      "✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅"
    );
    const message = (error as Error)?.message || "Something went wrong";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function DeSlugify(slug: string) {
  if (!slug) return "";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
