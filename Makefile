default: build

TARGET ?= gecko

PACKAGES := node_modules/.packages.build
BUILD := build.json
MANIFEST := manifest.json

NPATH := $(shell pwd)/node_modules/.bin
TOOLPATH := $(shell pwd)/tools/bin
SRC := $(shell find src scss pages templates images -type f 2>/dev/null)


########################################################
# Building & cleaning targets
########################################################

$(PACKAGES): package.json
	npm install
	touch $@

$(BUILD): $(SRC) $(MANIFEST) $(PACKAGES) Makefile
	$(MAKE) sass
	echo '{"git_commit": "$(or $(SOURCE_VERSION),$(shell git rev-parse HEAD))"}' > $@

sass:
	$(TOOLPATH)/sassrender --no-source-map

clean:
	rm -rf $(PACKAGES) builds css

realclean: clean
	rm -rf node_modules

build: $(BUILD)

lint:
	$(NPATH)/eslint src

translate:
	$(TOOLPATH)/translate

$(MANIFEST): manifest_base.json manifest_$(TARGET).json
	$(TOOLPATH)/mergejson manifest_base.json manifest_$(TARGET).json > $@

package:
	$(TOOLPATH)/package $(TARGET)


########################################################
# Runtime-only targets
########################################################
sass-watch:
	$(TOOLPATH)/sassrender --watch --no-source-map


.PHONY: lint sass clean realclean package