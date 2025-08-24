export interface ShopSyncPrice {
    value: number;
    currency: string;
    address?: string;
    requiredMeta?: string;
}

export interface ShopSyncItem {
    name: string;
    nbt?: string | null;
    displayName: string;
    description?: string | null;
}

export interface ShopSyncListing {
    prices: ShopSyncPrice[];
    item: ShopSyncItem;
    dynamicPrice?: boolean;
    stock?: number | null;
    madeOnDemand?: boolean;
    requiresInteraction?: boolean;
    shopBuysItem?: boolean;
    noLimit?: boolean;
}

export interface ShopSyncLocation {
    coordinates?: number[];
    description?: string;
    dimension?: "overworld" | "nether" | "end";
}

export interface ShopSyncSoftware {
    name?: string;
    version?: string;
}

export interface ShopSyncInfo {
    name: string;
    description?: string;
    owner?: string;
    computerID: number;
    multiShop?: number | null;
    software?: ShopSyncSoftware;
    location?: ShopSyncLocation;
    otherLocations?: ShopSyncLocation[];
}

export interface ShopSyncData {
    type: string;
    version?: number;
    info: ShopSyncInfo;
    items: ShopSyncListing[];
}

export function validateShopSyncData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if data exists
    if (!data) {
        errors.push("Data is required");
        return { isValid: false, errors };
    }

    // Validate top-level required fields
    if (data.type !== "ShopSync") {
        errors.push("Field 'type' must be 'ShopSync'");
    }

    if (data.version !== undefined && (typeof data.version !== "number" || !Number.isInteger(data.version))) {
        errors.push("Field 'version' must be an integer when provided");
    }

    // Validate info object
    if (!data.info || typeof data.info !== "object") {
        errors.push("Field 'info' is required and must be an object");
        return { isValid: false, errors };
    }

    // Validate required info fields
    if (!data.info.name || typeof data.info.name !== "string") {
        errors.push("Field 'info.name' is required and must be a string");
    }

    // Validate optional info fields
    if (data.info.description !== undefined && typeof data.info.description !== "string") {
        errors.push("Field 'info.description' must be a string when provided");
    }

    if (data.info.owner !== undefined && typeof data.info.owner !== "string") {
        errors.push("Field 'info.owner' must be a string when provided");
    }

    if (typeof data.info.computerID !== "number" || !Number.isInteger(data.info.computerID)) {
        errors.push("Field 'info.computerID' must be an integer");
    }

    if (data.info.multiShop !== undefined && data.info.multiShop !== null && (typeof data.info.multiShop !== "number" || !Number.isInteger(data.info.multiShop))) {
        errors.push("Field 'info.multiShop' must be an integer or null when provided");
    }

    // Validate software object
    if (data.info.software !== undefined) {
        if (typeof data.info.software !== "object") {
            errors.push("Field 'info.software' must be an object when provided");
        } else {
            if (data.info.software.name !== undefined && data.info.software.name !== null && typeof data.info.software.name !== "string") {
                errors.push("Field 'info.software.name' must be a string when provided");
            }
            if (data.info.software.version !== undefined && data.info.software.version !== null && typeof data.info.software.version !== "string") {
                errors.push("Field 'info.software.version' must be a string when provided");
            }
        }
    }

    // Validate location object
    if (data.info.location !== undefined) {
        const locationErrors = validateLocation(data.info.location, "info.location");
        errors.push(...locationErrors);
    }

    // Validate otherLocations array
    if (data.info.otherLocations !== undefined) {
        if (!Array.isArray(data.info.otherLocations)) {
            errors.push("Field 'info.otherLocations' must be an array when provided");
        } else {
            data.info.otherLocations.forEach((location: any, index: number) => {
                const locationErrors = validateLocation(location, `info.otherLocations[${index}]`);
                errors.push(...locationErrors);
            });
        }
    }

    // Validate items array
    if (!Array.isArray(data.items)) {
        errors.push("Field 'items' is required and must be an array");
        return { isValid: false, errors };
    }

    data.items.forEach((item: any, index: number) => {
        const itemErrors = validateItem(item, `items[${index}]`);
        errors.push(...itemErrors);
    });

    return { isValid: errors.length === 0, errors };
}

function validateLocation(location: any, fieldPath: string): string[] {
    const errors: string[] = [];

    if (typeof location !== "object") {
        errors.push(`Field '${fieldPath}' must be an object`);
        return errors;
    }

    if (location.coordinates !== undefined && location.coordinates !== null) {
        const coords = location.coordinates;

        const isValid =
            // case 1: empty object
            (typeof coords === "object" && !Array.isArray(coords) && Object.keys(coords).length === 0) ||
            // case 2: empty array
            (Array.isArray(coords) && coords.length === 0) ||
            // case 3: array of 3 integers
            (Array.isArray(coords) &&
                coords.length === 3 &&
                coords.every((c: any) => typeof c === "number" && Number.isInteger(c)));

        if (!isValid) {
            errors.push(
                `Field '${fieldPath}.coordinates' must be {}, an empty array, or an array of 3 integers`
            );
        }
    }

    if (location.description !== undefined && location.description !== null && typeof location.description !== "string") {
        errors.push(`Field '${fieldPath}.description' must be a string when provided`);
    }

    if (location.dimension !== undefined && location.dimension !== null && !["overworld", "nether", "end"].includes(location.dimension)) {
        errors.push(`Field '${fieldPath}.dimension' must be "overworld", "nether", or "end" when provided`);
    }

    return errors;
}

function validateItem(item: any, fieldPath: string): string[] {
    const errors: string[] = [];

    if (!item || typeof item !== "object") {
        errors.push(`Field '${fieldPath}' must be an object`);
        return errors;
    }

    // Validate prices array
    if (!Array.isArray(item.prices) || item.prices.length === 0) {
        errors.push(`Field '${fieldPath}.prices' is required and must be a non-empty array`);
    } else {
        item.prices.forEach((price: any, priceIndex: number) => {
            const priceErrors = validatePrice(price, `${fieldPath}.prices[${priceIndex}]`);
            errors.push(...priceErrors);
        });
    }

    // Validate item object
    if (!item.item || typeof item.item !== "object") {
        errors.push(`Field '${fieldPath}.item' is required and must be an object`);
    } else {
        if (!item.item.name || typeof item.item.name !== "string") {
            errors.push(`Field '${fieldPath}.item.name' is required and must be a string`);
        }

        if (item.item.nbt !== undefined && item.item.nbt !== null && typeof item.item.nbt !== "string") {
            errors.push(`Field '${fieldPath}.item.nbt' must be a string or null when provided`);
        }

        if (!item.item.displayName || typeof item.item.displayName !== "string") {
            errors.push(`Field '${fieldPath}.item.displayName' is required and must be a string`);
        }

        if (item.item.description !== undefined && item.item.description !== null && typeof item.item.description !== "string") {
            errors.push(`Field '${fieldPath}.item.description' must be a string or null when provided`);
        }
    }

    // Validate optional boolean fields
    if (item.dynamicPrice !== undefined && typeof item.dynamicPrice !== "boolean") {
        errors.push(`Field '${fieldPath}.dynamicPrice' must be a boolean when provided`);
    }

    if (item.madeOnDemand !== undefined && typeof item.madeOnDemand !== "boolean") {
        errors.push(`Field '${fieldPath}.madeOnDemand' must be a boolean when provided`);
    }

    if (item.requiresInteraction !== undefined && typeof item.requiresInteraction !== "boolean") {
        errors.push(`Field '${fieldPath}.requiresInteraction' must be a boolean when provided`);
    }

    if (item.shopBuysItem !== undefined && typeof item.shopBuysItem !== "boolean") {
        errors.push(`Field '${fieldPath}.shopBuysItem' must be a boolean when provided`);
    }

    if (item.noLimit !== undefined && typeof item.noLimit !== "boolean") {
        errors.push(`Field '${fieldPath}.noLimit' must be a boolean when provided`);
    }

    // Validate stock field
    if (item.stock !== undefined && item.stock !== null && (typeof item.stock !== "number" || !Number.isInteger(item.stock) || item.stock < 0)) {
        errors.push(`Field '${fieldPath}.stock' must be a non-negative integer or null when provided`);
    }

    return errors;
}

function validatePrice(price: any, fieldPath: string): string[] {
    const errors: string[] = [];

    if (!price || typeof price !== "object") {
        errors.push(`Field '${fieldPath}' must be an object`);
        return errors;
    }

    if (typeof price.value !== "number" || price.value < 0) {
        errors.push(`Field '${fieldPath}.value' is required and must be a non-negative number`);
    }

    if (!price.currency || typeof price.currency !== "string") {
        errors.push(`Field '${fieldPath}.currency' is required and must be a string`);
    }

    if (price.address !== undefined && price.address !== null && typeof price.address !== "string") {
        errors.push(`Field '${fieldPath}.address' must be a string when provided`);
    }

    if (price.requiredMeta !== undefined && price.requiredMeta !== null && typeof price.requiredMeta !== "string") {
        errors.push(`Field '${fieldPath}.requiredMeta' must be a string when provided`);
    }

    return errors;
}
