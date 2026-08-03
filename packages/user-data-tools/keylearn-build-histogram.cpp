#include "buffer.hpp"
#include "circ_buffer.hpp"
#include "mmapped_file.hpp"
#include "stats_data.hpp"
#include "stats_file_name.hpp"
#include "stats_result.hpp"

#include <array>
#include <cfenv>
#include <cmath>
#include <filesystem>
#include <iostream>

namespace fs = std::filesystem;

namespace keylearn {

std::array<u_int32_t, 751> hist_speed;
std::array<u_int32_t, 1001> hist_acc;

void build_histogram(const fs::path &path) {
  util::mmapped_file file(path, util::mmapped_file::SequentialScan);
  util::buffer buffer{file.data(), file.file_size()};
  keylearn::stats_data stats_data{buffer};

  if (!stats_data.check_signature()) {
    return;
  }

  double total_length = 0;
  double total_errors = 0;
  circ_buffer<std::pair<int32_t, int32_t>, 10> acc_buf;
  while (!stats_data.eof()) {
    keylearn::stats_result result;
    if (!stats_data.read_result(result)) {
      return;
    }
    if (!result.validate()) {
      continue;
    }
    auto time = result.time;
    auto length = result.length;
    auto errors = result.errors;
    auto complexity = result.histogram.sample_count;
    if (result.text_type_id == normal_text_id && time >= 1000 && length >= 30 &&
        complexity >= 15 && length > errors) {
      uint32_t speed = std::lround((length / (time / 1000.0)) * 60.0);
      if (speed > 0 && speed < hist_speed.size()) {
        hist_speed[speed] += 1;
      }
      if (acc_buf.full()) {
        auto p = acc_buf.dequeue();
        total_length -= p.first;
        total_errors -= p.second;
      }
      acc_buf.enqueue({length, errors});
      total_length += length;
      total_errors += errors;
      if (acc_buf.full()) {
        uint32_t acc =
            std::lround(((total_length - total_errors) / total_length) *
                        (hist_acc.size() - 1));
        if (acc > 0 && acc < hist_acc.size()) {
          hist_acc[acc] += 1;
        }
      }
    }
  }
}

template <typename T, std::size_t N>
void normalize_histogram(std::array<T, N> &hist) {
  u_int32_t max = 0;
  for (uint32_t i = 0; i < hist.size(); i++) {
    max = std::max(max, hist[i]);
  }
  if (max > 0) {
    for (uint32_t i = 0; i < hist.size(); i++) {
      hist[i] = ((double)hist[i] / (double)max) * 1000.0;
    }
  }
}

template <typename T, std::size_t N>
void print_histogram(std::array<T, N> &hist) {
  std::cout << "[";
  for (uint32_t i = 0; i < hist.size(); i++) {
    if (i > 0) {
      std::cout << ",";
    }
    std::cout << hist[i];
  }
  std::cout << "]";
  std::cout << std::endl;
}

} // namespace keylearn

int main(int argc, char *argv[]) {
  std::fesetround(FE_TONEAREST);

  fs::path root{keylearn::DEFAULT_ROOT};

  if (argc == 2) {
    root = fs::path{argv[1]};
  }

  if (!root.is_absolute()) {
    std::cout << "path " << root << " is not absolute" << std::endl;
    return EXIT_FAILURE;
  }

  if (!fs::is_directory(fs::status(root))) {
    std::cout << "path " << root << " is not a directory" << std::endl;
    return EXIT_FAILURE;
  }

  root = fs::canonical(root);

  keylearn::hist_speed.fill(0);
  keylearn::hist_acc.fill(0);

  for (fs::directory_entry const &entry :
       fs::recursive_directory_iterator(root)) {
    if (entry.is_regular_file()) {
      const fs::path &path = entry.path();
      keylearn::stats_file_id file_id;
      if (keylearn::parse_stats_file_name(path, file_id)) {
        if (file_id.user_id != 0 && file_id.backup_num == 0) {
          keylearn::build_histogram(path);
        }
      }
    }
  }

  keylearn::normalize_histogram(keylearn::hist_speed);
  keylearn::print_histogram(keylearn::hist_speed);

  keylearn::normalize_histogram(keylearn::hist_acc);
  keylearn::print_histogram(keylearn::hist_acc);

  return EXIT_SUCCESS;
}
