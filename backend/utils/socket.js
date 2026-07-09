const { Server } = require("socket.io");

let ioInstance = null;

const buildCorsOptions = (allowedOrigins) => ({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by Socket.IO CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true,
});

const initSocket = (httpServer, allowedOrigins) => {
  ioInstance = new Server(httpServer, {
    path: "/api/socket.io",
    cors: buildCorsOptions(allowedOrigins),
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = {
  initSocket,
  getIO,
};
