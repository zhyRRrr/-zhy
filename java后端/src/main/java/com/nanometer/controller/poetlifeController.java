package com.nanometer.controller;

import com.nanometer.pojo.NormalDistribution;
import com.nanometer.pojo.PlacePoetPair;
import com.nanometer.service.PoetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/poet-life")
@CrossOrigin(origins = "*", maxAge = 3600) // 允许跨域请求
public class poetlifeController {

    @Autowired
    private PoetService poetService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 获取诗人生命阶段的诗词分布数据
     * 
     * @param poetId 诗人ID
     * @return 诗人各年龄段的诗词数量分布
     */
    @GetMapping("/distribution/{poetId}")
    public ResponseEntity<List<NormalDistribution>> getPoetLifeStageDistribution(@PathVariable Integer poetId) {
        try {
            // 查询诗人信息
            String poetInfoSql = "SELECT StartYear, EndYear FROM poet WHERE poetID = ?";
            Map<String, Object> poetInfo = jdbcTemplate.queryForMap(poetInfoSql, poetId);

            if (poetInfo != null) {
                Integer birthYear = (Integer) poetInfo.get("StartYear");
                Integer deathYear = (Integer) poetInfo.get("EndYear");

                // 查询诗人的诗词总数
                String poemCountSql = "SELECT COUNT(*) FROM poems WHERE poetName = (SELECT NameHZ FROM poet WHERE poetID = ?)";
                Integer poemCount = jdbcTemplate.queryForObject(poemCountSql, Integer.class, poetId);

                if (poemCount == null)
                    poemCount = 0;

                // 调用服务层方法动态计算分布
                List<NormalDistribution> distributions = poetService.calculatePoetDistribution(birthYear, deathYear,
                        poemCount);

                return ResponseEntity.ok(distributions);
            }

            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 获取所有诗人的生命阶段分布概览
     * 
     * @return 所有诗人的分布数据
     */
    @GetMapping("/all-distributions")
    public ResponseEntity<Map<String, List<NormalDistribution>>> getAllPoetDistributions() {
        try {
            // 修改 SQL 查询，直接从 poet_summary 获取所需信息
            String poetSql = "SELECT poet_id, poet_name, birth_year, death_year, poem_count FROM poet_summary";
            List<Map<String, Object>> poetsSummary = jdbcTemplate.queryForList(poetSql);

            Map<String, List<NormalDistribution>> result = new HashMap<>();

            for (Map<String, Object> summary : poetsSummary) {
                // 从 poet_summary 结果中获取数据
                Integer poetId = ((Number) summary.get("poet_id")).intValue();
                String poetName = (String) summary.get("poet_name");

                Object startYearObj = summary.get("birth_year");
                Integer birthYear = startYearObj != null
                        ? (startYearObj instanceof Integer ? (Integer) startYearObj
                                : Integer.valueOf(startYearObj.toString()))
                        : null;

                Object endYearObj = summary.get("death_year");
                Integer deathYear = endYearObj != null
                        ? (endYearObj instanceof Integer ? (Integer) endYearObj
                                : Integer.valueOf(endYearObj.toString()))
                        : null;

                // 直接从 summary 获取 poem_count
                Object poemCountObj = summary.get("poem_count");
                Integer poemCount = poemCountObj != null
                        ? (poemCountObj instanceof Integer ? (Integer) poemCountObj
                                : Integer.valueOf(poemCountObj.toString()))
                        : 0; // 默认值为 0

                // 动态计算分布数据
                List<NormalDistribution> distributions = poetService.calculatePoetDistribution(birthYear, deathYear,
                        poemCount);

                if (distributions != null && !distributions.isEmpty()) {
                    result.put(poetName, distributions);
                }
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 获取所有现代地名 (PresentdayEquivalent) 及其对应的诗人名称 (NameHZ)，包括重复项
     *
     * @return 包含地点和诗人名称对的列表
     */
    @GetMapping("/all-places")
    public ResponseEntity<List<PlacePoetPair>> getAllPlacePoetPairs() {
        try {
            List<PlacePoetPair> placePoetPairs = poetService.getAllPlacePoetPairs();
            // 直接返回结果，即使为空也返回空列表
            return ResponseEntity.ok(placePoetPairs != null ? placePoetPairs : Collections.emptyList());
        } catch (Exception e) {
            e.printStackTrace(); // 记录异常信息
            // 返回服务器内部错误状态码
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * 根据年份范围和诗词数量计算正态分布
     */
    @GetMapping("/calculate")
    public ResponseEntity<List<NormalDistribution>> calculateDistribution(
            @RequestParam Integer startYear,
            @RequestParam Integer endYear,
            @RequestParam Integer count) {

        List<NormalDistribution> result = poetService.calculatePoetDistribution(startYear, endYear, count);
        return ResponseEntity.ok(result);
    }
}