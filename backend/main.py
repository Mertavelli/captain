import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.blocker import router as blocker_router
from routes.chat import router as chat_router
from routes.ct import router as ct_router
from routes.tasks import router as tasks_router
from routes.ticket_maintenance import router as ticket_maintenance_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # für lokales Testing
        "https://captain-frontend-nu.vercel.app",  # dein Vercel-Frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routes
app.include_router(chat_router, prefix="/api/chat", tags=["Chat"])
app.include_router(blocker_router, prefix="/api/blocker", tags=["Blocker"])
app.include_router(ct_router, prefix="/api/context-thread", tags=["Context Thread"])
app.include_router(tasks_router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(
    ticket_maintenance_router,
    prefix="/api/ticket-maintenance",
    tags=["Ticket Maintenance"],
)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
