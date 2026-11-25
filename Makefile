.DEFAULT_GOAL := help

# Export selectors directly. Recipe interpolation would treat their contents as shell code.
export SIMULATOR
export DEVICE
export CONFIGURATION
export DEVELOPMENT_TEAM

.PHONY: help setup start ios-sim ios-device build-ios-sim build-ios-device check test typecheck lint icons

help: ## Show local development commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Check local iOS prerequisites and install locked npm dependencies
	node scripts/setup.mjs

start: ## Start Metro for a development build
	npm run start

ios-sim: ## Build, install and run on an iOS simulator (optional SIMULATOR=name-or-UDID)
	node scripts/ios.mjs run simulator

ios-device: ## Build, install and run on an iPhone/iPad (optional DEVICE=name-or-UDID)
	node scripts/ios.mjs run device

build-ios-sim: ## Compile simulator app into build/ios-simulator (default Release; no Metro)
	node scripts/ios.mjs build simulator

build-ios-device: ## Compile signed device app into build/ios-device (default Release; no Metro)
	node scripts/ios.mjs build device

check: ## Run TypeScript, ESLint and automated tests
	npm run check

test: ## Run automated tests
	npm test

typecheck: ## Check TypeScript
	npm run typecheck

lint: ## Run ESLint
	npm run lint

icons: ## Regenerate app and splash icons from assets/icon.svg
	npm run icons
