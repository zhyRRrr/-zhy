package com.nanometer.controller;

// 导入相关的POJO类
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.nanometer.pojo.MainInfo;
import com.nanometer.pojo.Result;
import com.nanometer.service.PoetService;

import lombok.extern.slf4j.Slf4j;

// 使用Lombok的@Slf4j注解为类提供日志功能
@Slf4j
// 允许跨域请求，指定允许的来源
@CrossOrigin(origins = "http://localhost:5173")
// 标记该类为REST控制器
@RestController
// 设置该控制器的基本请求路径
@RequestMapping("/plumBlossom")
public class PoetController {

    // 自动注入PoetService服务类
    @Autowired
    private PoetService poetService;

    // 处理GET请求，路径为"/getFlowersChart"
    @GetMapping("/getFlowersChart")
    public Result getFlowersChart() {
        // 记录日志信息
        log.info("getFlowersChart");
        // 调用服务类的方法获取数据，并返回成功结果
        return Result.success(poetService.getFlowersChart());
    }

    // 处理GET请求，路径为"/getMainInfo"
    @GetMapping("/getMainInfo")
    public Result getTotalYears() {
        // 记录日志信息
        log.info("查询基本信息");
        // 调用服务类的方法获取主信息
        MainInfo mainInfo = poetService.getMainInfo();
        // 返回成功结果
        return Result.success(mainInfo);
    }

    // @GetMapping("/getFamilyPoets")
    // public Result getFamilyPoets(){
    // log.info("查询有家族诗人的信息");
    // FamilyPoet familyPoetList = poetService.getFamilyPoets();
    // return Result.success(familyPoetList);
    // }

    // @GetMapping("/getNoFamilyPoets")
    // public Result getNoFamilyPoets(){
    // log.info("查询没有家族诗人的信息");
    // NoFamilyInfo noFamilyPoetList = poetService.getNoFamilyPoets();
    // return Result.success(noFamilyPoetList);
    // }

    /**
     * 查询河流图数据
     * 
     * @return
     */
    @GetMapping("/getRiverData")
    public Result getRiverData() {
        log.info("查询河流图数据");
        return Result.success(poetService.getRiverData());
    }

    /**
     * 查询经过的年号
     * 
     * @param startYear
     * @param endYear
     * @return
     */
    @GetMapping("/getCycle")
    public Result getCycle(@RequestParam Integer startYear, @RequestParam Integer endYear) {
        log.info("根据开始年份{}和结束年份{}查询年号", startYear, endYear);
        return Result.success(poetService.getCycle(startYear, endYear));
    }

    /**
     * 查询地图数据
     * 
     * @return
     */
    @GetMapping("/getNavigate")
    public Result getNavigate() {
        log.info("查询地图信息");
        return Result.success(poetService.getNavigate());
    }

    // 添加接口返回情感
    @GetMapping("/emotion-coordinates")
    public Result getEmotionCoordinates() {
        return Result.success(poetService.getEmotionCoordinates());
    }

}
