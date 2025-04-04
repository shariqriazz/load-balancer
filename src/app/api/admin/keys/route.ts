import { NextRequest, NextResponse } from "next/server";
import { ApiKey } from "@/lib/models/ApiKey";
import keyManager from "@/lib/services/keyManager";
import { logError } from "@/lib/services/logger";

// GET /api/admin/keys - Get all API keys
export async function GET() {
  try {
    const keys = await ApiKey.findAll({});

    // Explicitly create plain objects and mask keys
    const responseKeys = keys.map((keyInstance) => {
      // Ensure all expected fields are present, using defaults from the instance
      const plainKeyObject = {
        _id: keyInstance._id,
        key: `${keyInstance.key.substring(0, 10)}...${keyInstance.key.substring(keyInstance.key.length - 4)}`, // Masked key
        name: keyInstance.name,
        isActive: keyInstance.isActive,
        lastUsed: keyInstance.lastUsed,
        rateLimitResetAt: keyInstance.rateLimitResetAt,
        failureCount: keyInstance.failureCount,
        requestCount: keyInstance.requestCount,
        dailyRateLimit: keyInstance.dailyRateLimit,
        dailyRequestsUsed: keyInstance.dailyRequestsUsed,
        lastResetDate: keyInstance.lastResetDate,
        isDisabledByRateLimit: keyInstance.isDisabledByRateLimit,
      };
      return plainKeyObject;
    });

    return NextResponse.json(responseKeys);
  } catch (error: any) {
    logError(error, { context: "GET /api/admin/keys" });
    return NextResponse.json(
      { error: error.message || "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST /api/admin/keys - Add a new API key
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, name, dailyRateLimit } = body; // Extract dailyRateLimit as well

    if (!key) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Validate dailyRateLimit (optional, must be number >= 0 or null/undefined)
    let validatedRateLimit: number | null | undefined = undefined;
    if (dailyRateLimit !== undefined && dailyRateLimit !== null) {
        const numLimit = Number(dailyRateLimit);
        if (!isNaN(numLimit) && numLimit >= 0) {
            validatedRateLimit = numLimit;
        } else if (String(dailyRateLimit).trim() === '') {
             // Allow empty string to mean 'no limit' -> null
             validatedRateLimit = null;
        } else {
            // Invalid non-numeric value provided
            return NextResponse.json(
                { error: "Invalid value provided for Daily Rate Limit. Must be a non-negative number or empty." },
                { status: 400 }
            );
        }
    } else if (dailyRateLimit === null) {
        validatedRateLimit = null; // Explicitly allow null
    }
    // If undefined, it remains undefined, letting the backend assign default (which is null)

    // Pass key, name, and validated dailyRateLimit to the keyManager method
    const newKey = await keyManager.addKey({ key, name, dailyRateLimit: validatedRateLimit });

    // Mask the key for the response
    const maskedKey = {
      ...newKey,
      key: `${newKey.key.substring(0, 10)}...${newKey.key.substring(
        newKey.key.length - 4
      )}`,
    };

    return NextResponse.json({
      message: "API key added successfully",
      key: maskedKey,
    });
  } catch (error: any) {
    logError(error, { context: "POST /api/admin/keys" });
    return NextResponse.json(
      { error: error.message || "Failed to add API key" },
      { status: 500 }
    );
  }
}
