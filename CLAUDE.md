# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `bun dev` - Start development server on port 4270
- `bun build` - Build production bundle
- `bun start` - Start production server on port 4270

### Testing
- `bun test` - Run all Jest tests
- `bun test:watch` - Run tests in watch mode
- `bun test:coverage` - Run tests with coverage report

### Linting & Code Quality
- `bun lint` - Run ESLint on codebase

### Database & Migration
- `bun migrate:db` - Migrate existing JSON data to SQLite database
- `bun generate:env` - Generate environment configuration

## Architecture Overview

This is a Next.js App Router application that serves as an OpenAI-compatible API proxy with load balancing and key management capabilities.

### Core Components

**Database Layer**: SQLite database (`data/database.db`) stores API keys, settings, request logs, and profiles. Uses WAL mode for better concurrency with proper connection pooling and graceful shutdown handling.

**Key Management System**: Thread-safe singleton `KeyManager` class with mutex-based concurrency control handles:
- Automatic key rotation based on request count or daily limits
- Profile-based key grouping for workload isolation
- Daily usage reset with UTC timezone handling
- Rate limit detection and cooldown management
- Failure tracking with automatic key deactivation

**Load Balancing**: `LoadBalancer` class supports multiple strategies:
- Round-robin (default, based on last used time)
- Random selection
- Least-connections (tracks active connections in memory)

**API Proxy**: Next.js API routes at `/api/v1/chat/completions` proxy requests to configurable OpenAI-compatible endpoints with automatic key rotation and error handling.

### Key Architecture Patterns

**Concurrency Safety**: All key operations use async-mutex to prevent race conditions in key rotation and state updates.

**Profile-Based Isolation**: Keys can be grouped into profiles to isolate different workloads or clients.

**Graceful Degradation**: System continues operating with remaining healthy keys when some keys fail or hit rate limits.

**Comprehensive Logging**: Winston-based logging with daily rotation for request logs, error logs, and key events.

### Data Models

**ApiKey**: Core model with fields for key management, usage tracking, rate limiting, and profile assignment.
**RequestLog**: Detailed logging of all API requests with performance metrics.
**Settings**: Application configuration stored in database with runtime updates.

### Security Features

- API keys are masked in UI and logs
- Session-based admin authentication with iron-session
- Optional master API key for incoming request authentication
- SQLite database with proper file permissions

### Testing

Uses Jest with testing utilities for services like `keyManager` and `loadBalancer`. Tests cover key rotation logic, load balancing strategies, and error handling scenarios.