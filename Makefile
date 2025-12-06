.PHONY: install test test-ui serve clean

install:
	npm install
	npx playwright install chromium
	mkdir -p sqlite
	curl -L -o /tmp/sqlite-wasm.zip https://sqlite.org/2025/sqlite-wasm-3510100.zip
	unzip -o /tmp/sqlite-wasm.zip -d sqlite
	rm /tmp/sqlite-wasm.zip

test:
	npm test

test-ui:
	npm run test:ui

serve:
	npm run serve

clean:
	rm -rf node_modules
	rm -rf playwright-report
	rm -rf test-results
	rm -f package-lock.json
