.PHONY: test test-unit test-e2e build package e2e check

test:
	swift test

test-unit:
	swift test --skip EndToEndTests

test-e2e:
	swift test --filter EndToEndTests

build:
	swift build

package:
	./scripts/package_app.sh

e2e:
	./scripts/e2e.sh

check: e2e
