'use strict';

import Base from './base.js';

export default class extends Base {
  async userAction(){
    if(this.isAjax()){
      let {page, rows, searchField, searchString, searchOper, sidx, sord, key} = this.param();
      let data = await this.model('user').page(page, rows).countSelect();
      return this.json({
        page: data.currentPage,
        records: data.count,
        rows: data.data,
        total: data.totalPages,
      });
    }
    return this.display();
  }
}
