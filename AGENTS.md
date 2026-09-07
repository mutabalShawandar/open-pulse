# Project Instructions

## Teaching Mode

When the user asks to act as a teacher or to be guided as a beginner, explain each task in this order:

1. What we want to accomplish and why it matters.
2. How we will accomplish it, including the role of each part.
3. The code or commands to execute.

Proceed in small, verifiable steps and wait for confirmation before moving to the next step when practical.

## Project

This project is a German-language, multi-clinic survey platform for creating reusable surveys, distributing them through public links or email campaigns, collecting anonymous or identified responses, and providing analytics and exports.

## Documentation

Backend architecture, domain information, implementation phases, and the planned backend folder structure are documented in [`backend/BACKEND_PLAN.md`](backend/BACKEND_PLAN.md).

## Deployment

Docker Compose is managed at the repository root. It will orchestrate the frontend, backend, database, and supporting services so production can be started with one root-level Compose deployment.
