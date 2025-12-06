.PHONY: install test test-ui serve clean check-solutions

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
	rm -rf .cache
	rm -f package-lock.json

# Pattern rule to test SQL solutions against expected output
# Usage: make .cache/1970/01/1.stamp
# The .stamp file acts as a witness that the test passed
.PRECIOUS: .cache/%.stamp
.cache/%.stamp: %.sql %-test-input.txt %-test-output.txt
	@mkdir -p $(dir $@)
	@echo "Testing $*.sql..."
	@EXPECTED=$$(cat $*-test-output.txt); \
	ACTUAL=$$(sqlite3 :memory: < $*.sql | tail -n 1 | cut -d'|' -f2); \
	if [ "$$ACTUAL" = "$$EXPECTED" ]; then \
		echo "✓ Test passed: $*.sql"; \
		touch $@; \
	else \
		echo "✗ Test failed: $*.sql"; \
		echo "  Expected: $$EXPECTED"; \
		echo "  Actual:   $$ACTUAL"; \
		exit 1; \
	fi

# Helper target to run all SQL solution tests
check-solutions:
	@find . -name '*-test-output.txt' | sed 's|\(.*\)/\(.*\)-test-output.txt|.cache/\1/\2.stamp|' | xargs make
