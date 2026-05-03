import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import botRouter from "./bot";
import logsRouter from "./logs";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(botRouter);
router.use(logsRouter);
router.use(statsRouter);

export default router;
