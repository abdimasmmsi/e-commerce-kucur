const { PrismaClient } = require("@prisma/client");

let prisma;
const getPrisma = () => {
  if (!prisma) prisma = new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  return prisma;
};
const connectPrisma = () => getPrisma().$connect();
const disconnectPrisma = () => prisma ? prisma.$disconnect() : Promise.resolve();

module.exports = { getPrisma, connectPrisma, disconnectPrisma };
