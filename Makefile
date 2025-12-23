.PHONY: install test test-unit test-e2e test-ui serve clean check-solutions solve-all

install:
	bun install
	bunx playwright install chromium

test: test-unit test-e2e

test-unit:
	bun test src/

test-e2e:
	bunx playwright test

test-ui:
	bun run test:ui

serve:
	bun run serve

clean:
	rm -rf node_modules
	rm -rf playwright-report
	rm -rf test-results
	rm -rf .cache
	rm -f package-lock.json

# Pattern rule to test SQL solutions against expected output
# Usage: make .cache/puzzles/1970/01/1.stamp
# The .stamp file acts as a witness that the test passed
.PRECIOUS: .cache/puzzles/%.stamp
.cache/puzzles/%.stamp: puzzles/%.sql puzzles/%-test-input.txt puzzles/%-test-output.txt
	@mkdir -p $(dir $@)
	@echo "Testing puzzles/$*.sql..."
	@EXPECTED=$$(cat puzzles/$*-test-output.txt); \
	ACTUAL=$$(bun src/bun-test-runner.js puzzles/$*.sql puzzles/$*-test-input.txt 2>/dev/null); \
	if [ "$$ACTUAL" = "$$EXPECTED" ]; then \
		echo "✓ Test passed: puzzles/$*.sql"; \
		mkdir -p $(dir $@); \
		touch $@; \
	else \
		echo "✗ Test failed: puzzles/$*.sql"; \
		echo "  Expected: $$EXPECTED"; \
		echo "  Actual:   $$ACTUAL"; \
		exit 1; \
	fi

# Helper target to run all SQL solution tests
check-solutions:
	@rm -rf .cache
	@find puzzles -name '*-test-output.txt' | sed 's|puzzles/\(.*\)-test-output.txt|.cache/puzzles/\1.stamp|' | xargs make

puzzles/%/2-real-input.txt: puzzles/%/1-real-input.txt
	gcp --update=older $^ $@

puzzles/%/2-test-input.txt: puzzles/%/1-test-input.txt
	gcp --update=older $^ $@

puzzles/%/2-test-output.txt: puzzles/%/1-test-output.txt
	gcp --update=older $^ $@

# Pattern rule to run SQL with real input and produce output
# Usage: make puzzles/1970/01/1-real-output.txt
# Depends on test passing first
.PRECIOUS: puzzles/%-real-output.txt
puzzles/%-real-output.txt: puzzles/%.sql puzzles/%-real-input.txt .cache/puzzles/%.stamp
	@echo "Running puzzles/$*.sql with real input..."
	@RESULT=$$(bun src/bun-test-runner.js puzzles/$*.sql puzzles/$*-real-input.txt 2>/dev/null); \
	echo "$$RESULT" | tee $@

# Helper target to run all SQL solutions with real input
# Usage: make solve-all
solve-all:
	@find puzzles -name '*.sql' | sed 's|\.sql|-real-output.txt|' | sort | xargs make
