import { Router, Request, Response, json } from "express";
import {writeFileSync, readFileSync, existsSync} from "fs";

const router = Router();

const saveJsonToFile = (data: unknown) => {
    writeFileSync('enderstorage.json', JSON.stringify(data, null, 2));
};

const loadJsonFromFile = (): unknown => {
    if (existsSync('enderstorage.json')) {
        return JSON.parse(readFileSync('enderstorage.json', 'utf8'));
    }
    return null;
};

let lastJsonData: unknown = loadJsonFromFile();


// Simple authentication middleware (you can replace this with your preferred auth method)
const authenticate = (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;

    // Simple bearer token check - replace with your actual authentication logic
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            ok: false,
            error: 'Authorization header missing or invalid'
        });
    }

    const token = authHeader.substring(7);

    if (token !== process.env.API_TOKEN) {
        return res.status(401).json({
            ok: false,
            error: 'Invalid token'
        });
    }

    next();
};

router.post('/', authenticate, json(), (req: Request, res: Response) => {
    try {
        // Store the JSON data
        lastJsonData = req.body;
        saveJsonToFile(lastJsonData);

        res.status(200).json({
            ok: true,
            message: 'JSON data stored successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            error: 'Invalid JSON data'
        });
    }
});

router.get('/', (req: Request, res: Response) => {
    if (lastJsonData === null) {
        return res.status(404).json({
            ok: false,
            error: 'No JSON data has been stored yet'
        });
    }

    res.status(200).json({
        ok: true,
        data: lastJsonData,
        retrievedAt: Date.now()
    });
});

export default router;
