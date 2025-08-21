import {Request, Response, NextFunction, RequestHandler} from "express";

// Simple authentication middleware (you can replace this with your preferred auth method)
export default (key: string): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        // Simple bearer token check - replace with your actual authentication logic
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                ok: false,
                error: 'Authorization header missing or invalid'
            });
        }

        const token = authHeader.substring(7);

        if (token !== key) {
            return res.status(401).json({
                ok: false,
                error: 'Invalid token'
            });
        }

        next();
    }
};
