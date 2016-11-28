
import Base from './base';

import _ from 'lodash';
import fs from 'fs';
import gm from 'gm';
import uuid from 'node-uuid';
import tesseract from 'node-tesseract';

import cheerio from 'cheerio';

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

    return {
      nsrmc: $('td', info_tr.eq(1)).eq(1).text(),
      nsrsbh: $('td', info_tr.eq(0)).eq(3).text()
    };
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

  async data(){
    let { sessionId } = this._logininfo;

    // 纳税人基本信息
    let nsrjbxx = await this.fetch_nsrjbxx();

    await this.httpGet('http://www.jsds.gov.cn/MainAction.do', {qs:{sessionId}});
    //let jkxx = await this.fetch_jkxx('2015-01-01','2016-12-31','');
    let dzjk = [
      ...(await this.fetch_dzjk('2013-01-01','2016-12-31','','','1')),
      ...(await this.fetch_dzjk('2013-01-01','2016-12-31','','','2'))
    ];

    let taxList = _.map(dzjk, o=>({
      name:o.sbblx,money:o.skhj,time:o.kkrq,remark:'地税-电子缴款'
    }));

    let info = {
      name: nsrjbxx.nsrmc,
      nsrsbh: nsrjbxx.nsrsbh
    }
    if(nsrjbxx.nsrsbh.length == 18) info.uscc = nsrjbxx.nsrsbh;

    return {nsrjbxx,dzjk,taxList, info};
  }
}
