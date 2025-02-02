import React from 'react'
// import Helmet from 'react-helmet'
import Base from '../Base'
import Sidebar from '../../fragments/Sidebar'
import styles from './Default.css'

export default class MainLayout extends React.Component {
  render() {
    const { children, sidebar } = this.props
    return (
      <Base className={styles.test}>
        <div className={styles.wrapper}>
          <Sidebar>
            {sidebar}
          </Sidebar>
          <div className={styles.content}>
            {children}
          </div>
        </div>
      </Base>
    )
  }
}
