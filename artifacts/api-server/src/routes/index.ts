import { Router, type IRouter } from "express";
import healthRouter from "./health";
import configRouter from "./config";
import botRouter from "../pipeline";
import logsRouter from "./logs";
import statsRouter from "./stats";
import mediaRouter from "./media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(configRouter);
router.use(botRouter);
router.use(logsRouter);
router.use(statsRouter);
router.use(mediaRouter);

export default router;
