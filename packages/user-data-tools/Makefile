COMPILER=g++
CFLAGS=-std=c++20 -Wall -Wextra -fwrapv -O2 -lm

all:
	$(COMPILER) $(CFLAGS) -o keylearn-check-stats \
		buffer.cpp \
		mmapped_file.cpp \
		stats_data.cpp \
		stats_file_name.cpp \
		stats_result.cpp \
		keylearn-check-stats.cpp
	$(COMPILER) $(CFLAGS) -o keylearn-build-histogram \
		buffer.cpp \
		mmapped_file.cpp \
		stats_data.cpp \
		stats_file_name.cpp \
		stats_result.cpp \
		keylearn-build-histogram.cpp

clean:
	rm keylearn-check-stats keylearn-build-histogram

format:
	find . -iname '*.hpp' -o -iname '*.cpp' | xargs clang-format -i
