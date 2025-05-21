// jest.setup.js
require('@testing-library/jest-dom');

// Polyfill TextEncoder and TextDecoder first
const util = require('node:util');
global.TextEncoder = util.TextEncoder;
global.TextDecoder = util.TextDecoder;

// Polyfill stream classes and MessageChannel/MessagePort before undici
const { ReadableStream, WritableStream } = require('node:stream/web');
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;

const { MessageChannel, MessagePort } = require('node:worker_threads');
global.MessageChannel = MessageChannel;
global.MessagePort = MessagePort;


// Polyfill Web API globals for Jest environment using undici
const {
  fetch,
  Request,
  Response,
  Headers,
  // ReadableStream, WritableStream, TextEncoder, TextDecoder, MessageChannel, MessagePort are now globally set
} = require('undici');

global.fetch = fetch;
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
// Ensure undici's versions of stream/text classes are also global if they differ and are expected
// For now, assume undici uses the globals or its own compatible versions.
// If issues persist, might need to explicitly set global.ReadableStream = require('undici').ReadableStream etc.

// You can add other global setup here if needed.