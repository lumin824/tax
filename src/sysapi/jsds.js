
import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import cheerio from 'cheerio';
import md5File from 'md5-file';

export default class extends Base {
  fetchCaptcha(){
    let codePath = 'code_' + uuid.v1() + '.jpg';
    return new Promise((resolve, reject)=>{
      let stream = gm(this.httpClient.get('http://www.jsds.gov.cn/index/fujia2.jsp'))
        .operator('gray', 'threshold', 50, true).stream();
      stream.pipe(fs.createWriteStream(codePath));
      stream.on('end', ()=>{
        tesseract.process(codePath, (error, text)=>{
          fs.unlink(codePath);
          error ? reject(error) : resolve(_.trim(text));
        });
      });
    });
  }
  async login(username, password){
    let captcha = await this.fetchCaptcha();
    while(captcha.length != 4){
      captcha = await this.fetchCaptcha();
    }

    let ret = await this.httpPost('http://www.jsds.gov.cn/LoginAction.do', {
      form: { jsonData: JSON.stringify({
        handleCode:'baseLogin',
        data:{zh:username, zhPassWord:password, zhYzm: captcha}
      })}
    });

    let {code:errno,msg:errmsg,data} = JSON.parse(ret.body);
    if(errno == '0'){
      errmsg = '';
      this._logininfo = data;
    }
    else{
      if(errno == '999904'){
        errno = 'ERR_01';
        errmsg = '代码错误';
      }else if(errno == '999902'){
        errno = 'ERR_02';
        errmsg = '密码错误';
      }else if(errno == '999901'){
        errno = 'ERR_03';
        errmsg = '验证码错误';
      }else{
        errno = 'SYS_' + errno;
      }
    }
    return {errno, errmsg};
  }

  async fetch_nsrjbxx(){
    let { sessionId } = this._logininfo;
    let res = await this.httpGet('http://www.jsds.gov.cn/NsrjbxxAction.do', {
      qs:{
        sessionId, dealMethod:'queryData', jsonData:JSON.stringify({
          data:{gnfldm:'CXFW',sqzldm:'',ssxmdm:''}
        })
      }
    });

    let $ = cheerio.load(res.body);
    let info_tbl = $('table').eq(0);
    let info_tr = $('tr', info_tbl);

    let tzfxx_tr = $('#t_tzfxx tr').toArray().slice(1);


    let tzfxx = _.map(tzfxx_tr, o=>({
      tzfmc: $('[name=tzfxxvo_tzfmc]', o).val(),
      zjzl: $('[name=tzfxxvo_zjzl]', o).val(),
      zjhm: $('[name=tzfxxvo_zjhm]', o).val(),
      tzbl: $('[name=tzfxxvo_tzbl]', o).val()
    }));

    let ret = {
      nsrmc: $('td', info_tr.eq(1)).eq(1).text(),
      nsrsbh: $('td', info_tr.eq(0)).eq(3).text(),
      scjyqx: $('td', info_tr.eq(4)).eq(3).text(),
      zcdz: $('td', info_tr.eq(6)).eq(1).text(),
      zcdyzbm: $('td', info_tr.eq(7)).eq(1).text(),
      zcdlxdh: $('td', info_tr.eq(7)).eq(3).text(),
      scjydz: $('td', info_tr.eq(8)).eq(1).text(),
      scdyzbm: $('td', info_tr.eq(9)).eq(1).text(),
      scdlxdh: $('td', info_tr.eq(9)).eq(3).text(),
      cyrs: $('td', info_tr.eq(11)).eq(1).text(),
      wjrs: $('input', info_tr.eq(11)).val(),
      jyfw: $('td', info_tr.eq(13)).eq(1).text(),
      zzhm: $('td', info_tr.eq(5)).eq(3).text(),
    };

    if(tzfxx.length){
      ret.tzfxx = tzfxx;
    }
    return ret;
  }

  // 缴款信息查询
  async fetch_jkxx(sbsjq, sbsjz, sbbzl){
    let { sessionId } = this._logininfo;
    let ret = await this.httpPost('http://www.jsds.gov.cn/JkxxcxAction.do', {
      form: {
        sbsjq,sbsjz,sbbzl,
        errorMessage:'',handleDesc:'查询缴款信息',handleCode:'queryData',
        cqSb:'0',sessionId
      }
    });

    let $ = cheerio.load(ret.body);
    let $trList = $('#querytb tr').toArray().slice(1);
    return _.map($trList, (o,i)=>{

      let $tdList = $('td', o);

      return {
        sbbzl: _.trim($tdList.eq(1).text()),
        sbrq: _.trim($tdList.eq(2).text()),
        skssqq: _.trim($tdList.eq(3).text()),
        skssqz: _.trim($tdList.eq(4).text()),
        yjkje: _.trim($tdList.eq(5).text()),
        wjkje: _.trim($tdList.eq(6).text()),
        dkje: _.trim($tdList.eq(7).text()),
        hxje: _.trim($tdList.eq(8).text()),
      }
    });
  }

  // 电子交款凭证查询打印
  async fetch_dzjk(sbrqq, sbrqz, kkrqq, kkrqz, lbzt){
    let { sessionId } = this._logininfo;
    let ret = await this.httpPost('http://www.jsds.gov.cn/QykkxxCxAction.do', {
      qs: {sessionId},
      form: {
        sbrqq,sbrqz,kkrqq,kkrqz,lbzt,
        errorMessage:'',sucessMsg:'',handleDesc:'扣款数据查询',handleCode:'queryData',
        cqSb:'0',sessionId
      }
    });
    let $ = cheerio.load(ret.body);
    return _.map($('#queryTb tr').toArray().slice(1), o=>{
      let $td = $('td', o);
      return {
        sbblx: _.trim($td.eq(1).text()),
        sbrq: _.trim($td.eq(2).text()),
        skhj: _.trim($td.eq(3).text()),
        jkfs: _.trim($td.eq(4).text()),
        sbfs: _.trim($td.eq(5).text()),
        kkrq: _.trim($td.eq(6).text()),
        rkrq: _.trim($td.eq(7).text()),
      }
    });
  }

  async fetch_cwbb(sbnf){
    console.log('获取财务报表:'+sbnf);
    let { sessionId } = this._logininfo;
    let swglm = sessionId.split(';')[0];
    let cwbbjdqx = 'Y01_120';
    let res = await this.httpPost('http://www.jsds.gov.cn/wb032_WBcwbbListAction.do', {
      qs: {sessionId},
      form: {
        sbnf,cwbbErrzt:'1',cwbbdldm:'CKL',errorMessage:'',
        swglm,curpzxh:'',handleDesc:'',handleCode:'submitSave',
        cwbbjdqxmc:'年度终了后4月内',cwbbjdqx
      }
    })

    console.log('获取财务报表step1');
    console.log(res.body);
    let $ = cheerio.load(res.body);
    let cwbbList = _.map($('#queryTb tr').toArray().slice(1), o=>{
      let $td = $('td', o);
      console.log('debug1');
      let deal_args = $td.eq(6).find('input').attr('onclick');

      if(!deal_args) return null;
      console.log('debug2');
      console.log(deal_args);
      deal_args = deal_args.substring(deal_args.indexOf('(')+1,deal_args.lastIndexOf(')'));
      console.log('debug3');
      deal_args = _.map(deal_args.split(','),o=>o.substr(1,o.length-2));
      console.log('debug4');
      let ret = {
        sbnf,
        bbzl: $td.eq(1).text().replace(/\s/g,''),
        url:deal_args[0],
        ssq:deal_args[1],
        pzxh:deal_args[2],
        czzt:deal_args[3],
        zt:deal_args[4],
        editzt:deal_args[5],
        ypzxh:deal_args[6],
        swglm:deal_args[7],
        sqssq:deal_args[8],
        bsqxdm:deal_args[9],
      };
      if(ret.pzxh){
        ret.href = ret.url + "?sessionId=" + sessionId + "&pzxh=" + ret.pzxh + "&ssq=" + encodeURI(ret.ssq) + "&BBZT="
        + ret.czzt + "&zt=" + ret.zt + "&editzt=" + ret.editzt + "&swglm=" + ret.swglm
				+ "&bsqxdm=" + ret.bsqxdm+"&cwbbjdqx=" + cwbbjdqx;
      }else{
        if (ypzxh != '') {
    			ret.href = ret.url + "?sessionId=" +sessionId+ "&ssq=" + encodeURI(ret.ssq) + "&BBZT=" + ret.zt
    					+ "&ypzxh=" + ret.ypzxh + "&swglm=" + ret.swglm + "&sqssq="
    					+ encodeURI(ret.sqssq) + "&bsqxdm=" + ret.bsqxdm+"&cwbbjdqx="+cwbbjdqx;
    		} else {
    			ret.href = ret.url + "?sessionId=" +sessionId+ "&ssq=" + encodeURI(ret.ssq) + "&BBZT=" + ret.zt
    					+ "&swglm=" + ret.swglm + "&sqssq=" + encodeURI(ret.sqssq)
    					+ "&bsqxdm=" + ret.bsqxdm+"&cwbbjdqx="+cwbbjdqx;
    		}
      }

      console.log(ret.href);
      return ret;
    });

    console.log('获取财务报表step2');

    cwbbList = _.compact(cwbbList);
    for(let i in cwbbList){
      let res = await this.httpGet('http://www.jsds.gov.cn'+cwbbList[i].href);
      let $ = cheerio.load(res.body);

      let table = $('input').toArray();
      table = _.mapKeys(table, o=>$(o).attr('id'));
      table = _.mapValues(table, o=>$(o).val());
      cwbbList[i].table = table;
    }

    console.log('获取财务报表step3');

    return cwbbList;
  }

  async data(){
    console.log('地税：获取数据中...');
    let { sessionId } = this._logininfo;

    // 纳税人基本信息
    let nsrjbxx = await this.fetch_nsrjbxx();

    await this.httpGet('http://www.jsds.gov.cn/MainAction.do', {qs:{sessionId}});
    //let jkxx = await this.fetch_jkxx('2015-01-01','2016-12-31','');
    console.log('地税：获取电子缴款...');
    let dzjk = [
      ...(await this.fetch_dzjk('2013-01-01','2016-12-31','','','1')),
      ...(await this.fetch_dzjk('2013-01-01','2016-12-31','','','2'))
    ];

    console.log('地税：获取财务报表...');
    let cwbb = [
      ...await this.fetch_cwbb('2016'),
      ...await this.fetch_cwbb('2015'),
      ...await this.fetch_cwbb('2014'),
      ...await this.fetch_cwbb('2013')
    ];

    console.log('地税：获取财务报表完毕');
    let taxList = _.map(dzjk, o=>({
      name:o.sbblx,money:o.skhj,time:o.kkrq,remark:'地税-电子缴款'
    }));

    let taxMoneyList = _.map(cwbb, o=>({
      year:o.sbnf,
      capital:(parseFloat(o.table.fzqmye27 || '0') + parseFloat(o.table.fzncye27 || '0'))/2,
      assets:(parseFloat(o.table.zcqmye32 || '0') + parseFloat(o.table.zcncye32 || '0'))/2,
      equity:(parseFloat(o.table.fzqmye31 || '0') + parseFloat(o.table.fzncye31 || '0'))/2,
      interest: o.table.bnljje18,
      liability:(parseFloat(o.table.fzqmye19 || '0') + parseFloat(o.table.fzncye19 || '0'))/2,
      revenue:parseFloat(o.table.bnljje1 || '0') + parseFloat(o.table.bnljje22 || '0'),
    }));

    let {nsrmc, ...oth} = nsrjbxx;

    let info = {
      name: nsrmc,
      ...oth
    }
    if(nsrjbxx.nsrsbh.length == 18) info.uscc = nsrjbxx.nsrsbh;

    let cwbbList = _.map(cwbb, o=>{

      let tempFile = 'runtime/jsds_'+uuid.v1()+'.txt';

      let t = o.table;
      fs.writeFileSync(tempFile,[
        '资产负债表',
        '资产\t\t期末余额\t\t月初余额',
        `流动资产\t\t${t.zcqmye1}\t\t${t.zcncye1}`,
        ` 货币资金\t\t${t.zcqmye2}\t\t${t.zcncye2}`,//1
        ` 短期投资\t\t${t.zcqmye3}\t\t${t.zcncye3}`,//2
        ` 应收票据\t\t${t.zcqmye4}\t\t${t.zcncye4}`,//3
        ` 应收账款\t\t${t.zcqmye5}\t\t${t.zcncye5}`,//4
        ` 预付账款\t\t${t.zcqmye6}\t\t${t.zcncye6}`,//5
        ` 应收股利\t\t${t.zcqmye7}\t\t${t.zcncye7}`,//6
        ` 应收利息\t\t${t.zcqmye8}\t\t${t.zcncye8}`,//7
        ` 其他应收款\t\t${t.zcqmye9}\t\t${t.zcncye9}`,//8
        ` 存货\t\t${t.zcqmye10}\t\t${t.zcncye10}`,//9
        '  其中：',
        `   原材料\t\t${t.zcqmye11}\t\t${t.zcncye11}`,//10
        `   在产品\t\t${t.zcqmye12}\t\t${t.zcncye12}`,//11
        `   库存商品\t\t${t.zcqmye13}\t\t${t.zcncye13}`,//12
        `   周转材料\t\t${t.zcqmye14}\t\t${t.zcncye14}`,//13
        ` 其他流动资产\t\t${t.zcqmye15}\t\t${t.zcncye15}`,//14
        `  流动资产合计\t\t${t.zcqmye16}\t\t${t.zcncye16}`,//15
        `非流动资产\t\t${t.zcqmye17}\t\t${t.zcncye17}`,
        ` 长期债券投资\t\t${t.zcqmye18}\t\t${t.zcncye18}`,//16
        ` 长期股权投资\t\t${t.zcqmye19}\t\t${t.zcncye19}`,//17
        ` 固定资产原价\t\t${t.zcqmye20}\t\t${t.zcncye20}`,//18
        ` 减：累计折旧\t\t${t.zcqmye21}\t\t${t.zcncye21}`,//19
        ` 固定资产账面价值\t\t${t.zcqmye22}\t\t${t.zcncye22}`,//20
        ` 在建工程\t\t${t.zcqmye23}\t\t${t.zcncye23}`,//21
        ` 工程物资\t\t${t.zcqmye24}\t\t${t.zcncye24}`,//22
        ` 固定资产清理\t\t${t.zcqmye25}\t\t${t.zcncye25}`,//23
        ` 生产性生物资产\t\t${t.zcqmye26}\t\t${t.zcncye26}`,//24
        ` 无形资产\t\t${t.zcqmye7}\t\t${t.zcncye27}`,//25
        ` 开发支出\t\t${t.zcqmye28}\t\t${t.zcncye28}`,//26
        ` 长期待摊费用\t\t${t.zcqmye29}\t\t${t.zcncye29}`,//27
        ` 其他非流动资产\t\t${t.zcqmye30}\t\t${t.zcncye30}`,//28
        `  非流动资产合计\t\t${t.zcqmye31}\t\t${t.zcncye31}`,//29
        `   资产合计\t\t${t.zcqmye32}\t\t${t.zcncye32}`,//30
        '',
        '负债和所有者权益\t\t期末余额\t\t月初余额',
        `流动负债\t\t${t.fzqmye1}\t\t${t.fzncye1}`,
        ` 短期借款\t\t${t.fzqmye2}\t\t${t.fzncye2}`,//31
        ` 应付票据\t\t${t.fzqmye3}\t\t${t.fzncye3}`,//32
        ` 应付账款\t\t${t.fzqmye4}\t\t${t.fzncye4}`,//33
        ` 预收账款\t\t${t.fzqmye5}\t\t${t.fzncye5}`,//34
        ` 应付职工薪酬\t\t${t.fzqmye6}\t\t${t.fzncye6}`,//35
        ` 应交税费\t\t${t.fzqmye7}\t\t${t.fzncye7}`,//36
        ` 应付利息\t\t${t.fzqmye8}\t\t${t.fzncye8}`,//37
        ` 应付利润\t\t${t.fzqmye9}\t\t${t.fzncye9}`,//38
        ` 其他应付款\t\t${t.fzqmye10}\t\t${t.fzncye10}`,//39
        ` 其他流动负债\t\t${t.fzqmye11}\t\t${t.fzncye11}`,//40
        `  流动负债合计\t\t${t.fzqmye12}\t\t${t.fzncye12}`,//41
        `非流动负债\t\t${t.fzqmye13}\t\t${t.fzncye13}`,
        ` 长期借款\t\t${t.fzqmye14}\t\t${t.fzncye14}`,//42
        ` 长期应付款\t\t${t.fzqmye15}\t\t${t.fzncye15}`,//43
        ` 递延收益\t\t${t.fzqmye16}\t\t${t.fzncye16}`,//44
        ` 其他非流动负债\t\t${t.fzqmye17}\t\t${t.fzncye17}`,//45
        `  非流动负债合计\t\t${t.fzqmye18}\t\t${t.fzncye18}`,//46
        `   负债合计\t\t${t.fzqmye19}\t\t${t.fzncye19}`,//47

        `所有者权益（或股东权益）\t\t${t.fzqmye26}\t\t${t.fzncye26}`,
        ` 实收资本（或股本）\t\t${t.fzqmye27}\t\t${t.fzncye27}`,//48
        ` 资本公积\t\t${t.fzqmye28}\t\t${t.fzncye28}`,//49
        ` 盈余公积\t\t${t.fzqmye29}\t\t${t.fzncye29}`,//50
        ` 未分配利润\t\t${t.fzqmye30}\t\t${t.fzncye30}`,//51
        `  所有者权益（或股东权益）合计\t\t${t.fzqmye31}\t\t${t.fzncye31}`,//52
        `  负债和所有者权益(或股东权益)总计\t\t${t.fzqmye32}\t\t${t.fzncye32}`,//53
        '',
        '',
        '利润表',
        '项目\t\t本年累计金额\t\t本月金额',
        `一、营业收入\t\t${t.bnljje1}\t\t${t.byje1}`,//1
        `减：营业成本\t\t${t.bnljje2}\t\t${t.byje2}`,//2
        ` 营业税金及附加\t\t${t.bnljje3}\t\t${t.byje3}`,//3
        '  其中：',
        `  消费税\t\t${t.bnljje4}\t\t${t.byje4}`,//4
        `  营业税\t\t${t.bnljje5}\t\t${t.byje5}`,//5
        `  城市维护建设税\t\t${t.bnljje6}\t\t${t.byje6}`,//6
        `  资源税\t\t${t.bnljje7}\t\t${t.byje7}`,//7
        `  土地增值税\t\t${t.bnljje8}\t\t${t.byje8}`,//8
        `  城镇土地使用税、房产税、车船税、印花税\t\t${t.bnljje9}\t\t${t.byje9}`,//9
        `  教育费附加、矿产资源补偿费、排污费\t\t${t.bnljje10}\t\t${t.byje10}`,//10
        ` 销售费用\t\t${t.bnljje11}\t\t${t.byje11}`,//11
        '  其中：',
        `  商品维修费\t\t${t.bnljje12}\t\t${t.byje12}`,//12
        `  广告费和业务宣传费\t\t${t.bnljje13}\t\t${t.byje13}`,//13
        ` 管理费用\t\t${t.bnljje14}\t\t${t.byje14}`,//14
        '  其中：',
        `  开办费\t\t${t.bnljje15}\t\t${t.byje15}`,//15
        `  业务招待费\t\t${t.bnljje16}\t\t${t.byje16}`,//16
        `  研究费用\t\t${t.bnljje17}\t\t${t.byje17}`,//17
        ` 财务费用\t\t${t.bnljje18}\t\t${t.byje18}`,//18
        `  其中：利息费用（收入以“—”号填列）\t\t${t.bnljje19}\t\t${t.byje19}`,//19
        `加：投资收益(亏损以–填列)\t\t${t.bnljje20}\t\t${t.byje20}`,//20
        '',
        `二、营业利润（亏损以“-”号填列）\t\t${t.bnljje21}\t\t${t.byje21}`,//21
        `加：营业外收入\t\t${t.bnljje22}\t\t${t.byje22}`,//22
        ` 其中：政府补助\t\t${t.bnljje23}\t\t${t.byje23}`,//23
        `减：营业外支出\t\t${t.bnljje24}\t\t${t.byje24}`,//24
        ' 其中：',
        ` 坏账损失\t\t${t.bnljje25}\t\t${t.byje25}`,//25
        ` 无法收回的长期债券投资损失\t\t${t.bnljje26}\t\t${t.byje26}`,//26
        ` 无法收回的长期股权投资损失\t\t${t.bnljje27}\t\t${t.byje27}`,//27
        ` 自然灾害等不可抗力因素造成的损失\t\t${t.bnljje28}\t\t${t.byje28}`,//28
        ` 税收滞纳金\t\t${t.bnljje29}\t\t${t.byje29}`,//29
        '',
        `三、利润总额（亏损总额以“-”号填列）\t\t${t.bnljje30}\t\t${t.byje30}`,//30
        `减：所得税费用\t\t${t.bnljje31}\t\t${t.byje31}`,//31
        '',
        `四、净利润（净亏损以“-”号填列）\t\t${t.bnljje32}\t\t${t.byje32}`,//32

        '',
        '',
        '现金流量表',
        '项目\t\t本年累计金额\t\t本月金额',
        `一、经营活动产生的现金流量\t\t${t.xjbnljje1}\t\t${t.xjbyje1}`,
        ` 销售产成品、商品、提供劳务收到的现金\t\t${t.xjbnljje2}\t\t${t.xjbyje2}`,//1
        ` 收到的其他与经营活动有关的现金\t\t${t.xjbnljje3}\t\t${t.xjbyje3}`,//2
        ` 购买原材料、商品、接受劳务支付的现金\t\t${t.xjbnljje4}\t\t${t.xjbyje4}`,//3
        ` 支付的职工薪酬\t\t${t.xjbnljje5}\t\t${t.xjbyje5}`,//4
        ` 支付的税费\t\t${t.xjbnljje6}\t\t${t.xjbyje6}`,//5
        ` 支付的其他与经营活动有关的现金\t\t${t.xjbnljje7}\t\t${t.xjbyje7}`,//6
        `  经营活动产生的现金流量净额\t\t${t.xjbnljje8}\t\t${t.xjbyje8}`,//7
        `二、投资活动产生的现金流量：\t\t${t.xjbnljje9}\t\t${t.xjbyje9}`,
        ` 收回短期投资、长期债券投资和长期股权投资收到的现金\t\t${t.xjbnljje10}\t\t${t.xjbyje10}`,//8
        ` 取得投资收益收到的现金\t\t${t.xjbnljje11}\t\t${t.xjbyje11}`,//9
        ` 处置固定资产、无形资产和其他非流动资产收回的现金净额\t\t${t.xjbnljje12}\t\t${t.xjbyje12}`,//10
        ` 短期投资、长期债券投资和长期股权投资支付的现金\t\t${t.xjbnljje13}\t\t${t.xjbyje13}`,//11
        ` 购建固定资产、无形资产和其他非流动资产支付的现金\t\t${t.xjbnljje14}\t\t${t.xjbyje14}`,//12
        `  投资活动产生的现金流量净额\t\t${t.xjbnljje15}\t\t${t.xjbyje15}`,//13
        `三、筹资活动产生的现金流量：\t\t${t.xjbnljje16}\t\t${t.xjbyje16}`,
        ` 取得借款收到的现金\t\t${t.xjbnljje17}\t\t${t.xjbyje17}`,//14
        ` 吸收投资者投资收到的现金\t\t${t.xjbnljje18}\t\t${t.xjbyje18}`,//15
        ` 偿还借款本金支付的现金\t\t${t.xjbnljje19}\t\t${t.xjbyje19}`,//16
        ` 偿还借款利息支付的现金\t\t${t.xjbnljje20}\t\t${t.xjbyje20}`,//17
        ` 分配利润支付的现金\t\t${t.xjbnljje21}\t\t${t.xjbyje21}`,//18
        `  筹资活动产生的现金流量净额\t\t${t.xjbnljje22}\t\t${t.xjbyje22}`,//19
        `四、现金净增加额\t\t${t.xjbnljje23}\t\t${t.xjbyje23}`,//20
        `加：期初现金余额\t\t${t.xjbnljje24}\t\t${t.xjbyje24}`,//21
        `五、期末现金余额\t\t${t.xjbnljje25}\t\t${t.xjbyje25}`,//22
      ].join('\n'));
      let hash = md5File.sync(tempFile);
      fs.renameSync(tempFile, think.RUNTIME_PATH + '/archive/' + hash);
      return {
        name: o.bbzl,
        time: o.sbnf,
        archiveList:[{name:'报表',hash,type:'txt'}],
        remark: '地税'
      }
    });

    let ckzhList = await this.fetch_ckzh();
    info.ckzhList = ckzhList;

    return {nsrjbxx,dzjk,taxList,taxMoneyList,info, cwbb,cwbbList};
  }

  async fetch_ckzh(){
    let { sessionId } = this._logininfo;

    let ret = await this.httpPost('http://www.jsds.gov.cn/NsrkhyhAction.do', {
      qs: {
        handleCode:'',sqzldm:'null',ssxmdm:'null',gnfldm:'null', sessionId,
        jsonData:JSON.stringify({
          data:{ gnfldm:'CXFW', sqzldm:'',ssxmdm:''}
        })
      }
    });

    let $ = cheerio.load(ret.body);

    let trList = $('#querytb>tr').toArray();

    return _.map(trList, o=>{
      let tdList = $('td', o);
      return {
        yhhb: _.trim(tdList.eq(3).text()),
        yhdm: _.trim(tdList.eq(4).text()),
        yhzh: _.trim(tdList.eq(5).text())
      }
    });
  }
}
